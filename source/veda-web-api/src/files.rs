use crate::common::{extract_addr, get_ticket};
use actix_files::NamedFile;
use actix_multipart::Multipart;
use actix_web::http::header::ExtendedValue;
use actix_web::http::header::{Charset, DispositionParam};
use actix_web::http::HeaderValue;
use actix_web::http::{header, StatusCode};
use actix_web::{get, Result as ActixResult};
use actix_web::{web, HttpRequest, HttpResponse, Responder};
use async_std::io;
use async_std::path::Path;
use chrono::{DateTime, NaiveDateTime, Utc};
use filetime::FileTime;
use futures::lock::Mutex;
use futures::{AsyncWriteExt, StreamExt, TryStreamExt};
use std::fs::File;
use std::io::Read;
use std::{env, fs};
use uuid::Uuid;
use v_common::az_impl::az_lmdb::LmdbAzContext;
use v_common::storage::async_storage::{check_ticket, get_individual_from_db, AStorage, TicketCache};
use v_common::v_api::obj::ResultCode;

#[get("/files/{file_id}")]
pub(crate) async fn load_file(
    ticket_cache: web::Data<TicketCache>,
    db: web::Data<AStorage>,
    az: web::Data<Mutex<LmdbAzContext>>,
    req: HttpRequest,
) -> io::Result<HttpResponse> {
    let (res, user_uri) = check_ticket(&get_ticket(&req, &None), &ticket_cache, &extract_addr(&req), &db).await?;
    if res != ResultCode::Ok {
        return Ok(HttpResponse::new(StatusCode::from_u16(res as u16).unwrap()));
    }

    if let Some(file_id) = req.path().strip_prefix("/files/") {
        debug!("get file, file_id: {}, user: {:?}", file_id, user_uri);
        let (mut file_info, res_code) = get_individual_from_db(file_id, &user_uri.unwrap_or_default(), &db, Some(&az)).await?;

        if res_code != ResultCode::Ok {
            return Ok(HttpResponse::new(StatusCode::from_u16(res_code as u16).unwrap()));
        }

        let path = format!("./data/files/{}/{}", file_info.get_first_literal_or_err("v-s:filePath")?, file_info.get_first_literal_or_err("v-s:fileUri")?);

        let file = NamedFile::open(&path)?;
        let metadata = file.metadata()?;
        if let Ok(mut resp) = file.respond_to(&req).await {
            let original_file_name = file_info.get_first_literal_or_err("v-s:fileName")?;

            let file_path = Path::new(&original_file_name);
            let file_ext = file_path.extension().unwrap().to_str().unwrap();
            let file_mime = actix_files::file_extension_to_mime(file_ext);

            let last_modified =
                DateTime::<Utc>::from_utc(NaiveDateTime::from_timestamp(FileTime::from_last_modification_time(&metadata).unix_seconds(), 0), Utc).to_rfc2822();

            let mut http_resp = HttpResponse::Ok()
                .header(header::LAST_MODIFIED, last_modified)
                .header(header::ACCEPT_RANGES, "bytes")
                .header(header::CONTENT_LENGTH, file_info.get_first_integer("v-s:fileSize").unwrap_or_default() as u64)
                .header(
                    header::CONTENT_DISPOSITION,
                    header::ContentDisposition {
                        disposition: header::DispositionType::Attachment,
                        parameters: vec![DispositionParam::FilenameExt(ExtendedValue {
                            charset: Charset::Ext("UTF-8".to_owned()),
                            language_tag: None,
                            value: original_file_name.into_bytes(),
                        })],
                    },
                )
                .content_type(file_mime.essence_str())
                .streaming(resp.take_body());

            http_resp.headers_mut().insert(header::CONTENT_LENGTH, HeaderValue::from(50));

            return Ok(http_resp);
        }
    }

    Ok(HttpResponse::new(StatusCode::from_u16(ResultCode::BadRequest as u16).unwrap()))
}

async fn check_and_create_file(path: &str, prefix: Option<&str>, uri: &str, f: &mut Vec<async_std::fs::File>) -> io::Result<()> {
    if !path.is_empty() && !uri.is_empty() && f.is_empty() {
        async_std::fs::create_dir_all(&path).await?;
        f.push(async_std::fs::File::create(format!("{}/{}{}", path, prefix.unwrap_or_default(), sanitize_filename::sanitize(&uri))).await?);
    }
    Ok(())
}

pub(crate) async fn save_file(mut payload: Multipart) -> ActixResult<impl Responder> {
    let base_path = "./data/files/";
    let mut path = String::new();
    let mut uri = String::new();
    let mut tmp_encoded_file: Vec<async_std::fs::File> = Vec::default();
    let tmp_path = env::temp_dir().to_str().unwrap_or("tmp").to_owned();
    let upload_prefix = format!("veda-upload-{}", &Uuid::new_v4().to_string());
    while let Ok(Some(mut field)) = payload.try_next().await {
        let content_type = field.content_disposition().ok_or(actix_web::error::ParseError::Incomplete)?;

        if let Some(name) = content_type.get_name() {
            while let Some(chunk) = field.next().await {
                match name {
                    "path" => {
                        path = std::str::from_utf8(&chunk?)?.to_owned();
                    }
                    "uri" => {
                        uri = std::str::from_utf8(&chunk?)?.to_owned();
                    }
                    "file" => {
                        let cur_chunk = &chunk?;
                        check_and_create_file(&tmp_path, Some(&upload_prefix), &uri, &mut tmp_encoded_file).await?;

                        if let Some(ff) = tmp_encoded_file.get_mut(0) {
                            AsyncWriteExt::write_all(ff, cur_chunk).await?;
                        }
                    }
                    "content" => {
                        let cur_chunk = &chunk?;

                        if tmp_encoded_file.is_empty() {
                            let mut pos = 0;
                            for (idx, b) in cur_chunk.iter().enumerate() {
                                if b == &(b',') {
                                    pos = idx + 1;
                                    break;
                                }
                            }
                            if pos > 7 {
                                check_and_create_file(&tmp_path, Some(&upload_prefix), &uri, &mut tmp_encoded_file).await?;
                                if let Some(ff) = tmp_encoded_file.get_mut(0) {
                                    AsyncWriteExt::write_all(ff, cur_chunk.split_at(pos).1).await?;
                                }
                            }
                        } else {
                            check_and_create_file(&tmp_path, Some(&upload_prefix), &uri, &mut tmp_encoded_file).await?;
                            if let Some(ff) = tmp_encoded_file.get_mut(0) {
                                AsyncWriteExt::write_all(ff, cur_chunk).await?;
                            }
                        }
                    }
                    _ => {
                        error!("unknown param [{}]", name);
                    }
                }
            }
        }
    }

    if let Some(ff) = tmp_encoded_file.get_mut(0) {
        AsyncWriteExt::flush(ff).await?;
        AsyncWriteExt::close(ff).await?;
    }

    info!("@10");
    let tmp_file = format!("{}/{}{}", tmp_path, upload_prefix, sanitize_filename::sanitize(&uri));
    info!("@11 {}", tmp_file);
    let mut f_in = File::open(tmp_file.clone())?;

    info!("@20");
    let mut decoder = base64::read::DecoderReader::new(&mut f_in, base64::STANDARD);
    let mut result = Vec::new();
    decoder.read_to_end(&mut result)?;
    info!("@30");

    let mut out_file: Vec<async_std::fs::File> = Vec::default();
    check_and_create_file(&format!("{}/{}", base_path, path), None, &uri, &mut out_file).await?;
    if let Some(ff) = out_file.get_mut(0) {
        AsyncWriteExt::write_all(ff, &result).await?;
        AsyncWriteExt::flush(ff).await?;
        AsyncWriteExt::close(ff).await?;
    }
    info!("@40");

    fs::remove_file(tmp_file)?;
    info!("@50");

    Ok(HttpResponse::Ok())
}
