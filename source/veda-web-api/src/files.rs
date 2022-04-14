use crate::common::{extract_addr, get_ticket};
use actix_files::NamedFile;
use actix_multipart::Multipart;
use actix_web::http::header::ExtendedValue;
use actix_web::http::header::{Charset, DispositionParam};
use actix_web::http::HeaderValue;
use actix_web::http::{header, StatusCode};
use actix_web::{get, Result as ActixResult};
use actix_web::{web, HttpRequest, HttpResponse, Responder};
use async_std::fs as async_fs;
use async_std::io;
use async_std::path::Path;
use chrono::{DateTime, NaiveDateTime, Utc};
use filetime::FileTime;
use futures::lock::Mutex;
use futures::{AsyncWriteExt, StreamExt, TryStreamExt};
use std::fs::File;
use std::io::Read;
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
    let ticket = get_ticket(&req, &None);
    let addr = extract_addr(&req);
    let (res, w_user_uri) = check_ticket(&ticket, &ticket_cache, &addr, &db).await?;
    if res != ResultCode::Ok {
        return Ok(HttpResponse::new(StatusCode::from_u16(res as u16).unwrap()));
    }

    let user_uri = w_user_uri.unwrap_or("unknown".to_owned());

    if let Some(file_id) = req.path().strip_prefix("/files/") {
        let (mut file_info, res_code) = get_individual_from_db(file_id, &user_uri, &db, Some(&az)).await?;

        if res_code != ResultCode::Ok {
            return Ok(HttpResponse::new(StatusCode::from_u16(res_code as u16).unwrap()));
        }

        let path = format!("./data/files/{}/{}", file_info.get_first_literal_or_err("v-s:filePath")?, file_info.get_first_literal_or_err("v-s:fileUri")?);

        info!("user = {}/{}/{:?}, get file {}", user_uri, ticket.unwrap_or("unknown".to_owned()), addr, &path);

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

async fn check_and_create_file(path: &str, file_name: &str, f: &mut Vec<async_std::fs::File>) -> io::Result<String> {
    let full_path = format!("{}/{}", path, file_name);

    if !path.is_empty() && f.is_empty() {
        async_std::fs::create_dir_all(&path).await?;
        f.push(async_std::fs::File::create(full_path.clone()).await?);
    }
    Ok(full_path)
}

pub(crate) async fn save_file(mut payload: Multipart, ticket_cache: web::Data<TicketCache>, db: web::Data<AStorage>, req: HttpRequest) -> ActixResult<impl Responder> {
    let ticket = get_ticket(&req, &None);
    let addr = extract_addr(&req);
    let (res, user_uri) = check_ticket(&ticket, &ticket_cache, &addr, &db).await?;
    if res != ResultCode::Ok {
        return Ok(HttpResponse::new(StatusCode::from_u16(res as u16).unwrap()));
    }

    let base_path = "./data/files";
    let mut path = String::new();
    let mut uri = String::new();
    let mut tmp_file: Vec<async_std::fs::File> = Vec::default();
    let tmp_path = "./data/files/tmp";
    if Path::new(&tmp_path).exists().await {
        async_std::fs::create_dir_all(&tmp_path).await.unwrap();
    }
    let upload_tmp_id = format!("veda-upload-{}", &Uuid::new_v4().to_string());

    let mut is_encoded_file = false;

    while let Ok(Some(mut field)) = payload.try_next().await {
        let content_type = field.content_disposition().ok_or(actix_web::error::ParseError::Incomplete)?;

        if let Some(name) = content_type.get_name() {
            while let Some(chunk) = field.next().await {
                match name {
                    "path" => {
                        path = std::str::from_utf8(&chunk?)?.to_owned();
                    },
                    "uri" => {
                        uri = std::str::from_utf8(&chunk?)?.to_owned();
                    },
                    "file" => {
                        let cur_chunk = &chunk?;
                        check_and_create_file(&tmp_path, &upload_tmp_id, &mut tmp_file).await?;

                        if let Some(ff) = tmp_file.get_mut(0) {
                            AsyncWriteExt::write_all(ff, cur_chunk).await?;
                        }
                    },
                    "content" => {
                        is_encoded_file = true;
                        let cur_chunk = &chunk?;

                        if tmp_file.is_empty() {
                            let mut pos = 0;
                            for (idx, b) in cur_chunk.iter().enumerate() {
                                if b == &(b',') {
                                    pos = idx + 1;
                                    break;
                                }
                            }

                            if pos > 7 {
                                check_and_create_file(&tmp_path, &upload_tmp_id, &mut tmp_file).await?;
                                if let Some(ff) = tmp_file.get_mut(0) {
                                    AsyncWriteExt::write_all(ff, cur_chunk.split_at(pos).1).await?;
                                }
                            }
                        } else {
                            check_and_create_file(&tmp_path, &upload_tmp_id, &mut tmp_file).await?;
                            if let Some(ff) = tmp_file.get_mut(0) {
                                AsyncWriteExt::write_all(ff, cur_chunk).await?;
                            }
                        }
                    },
                    _ => {
                        error!("unknown param [{}]", name);
                    },
                }
            }
        }
    }

    if let Some(ff) = tmp_file.get_mut(0) {
        AsyncWriteExt::flush(ff).await?;
        AsyncWriteExt::close(ff).await?;
    }

    let tmp_file_path = format!("{}/{}", tmp_path, upload_tmp_id);
    let dest_file_path = &format!("{}{}", base_path, path);
    let file_full_name = format!("{}/{}", dest_file_path, sanitize_filename::sanitize(&uri));
    info!("user = {}/{}/{:?}, upload file {}", user_uri.unwrap_or("unknown".to_owned()), ticket.unwrap_or("unknown".to_owned()), addr, file_full_name);

    if is_encoded_file {
        let mut f_in = File::open(tmp_file_path.clone())?;
        let mut decoder = base64::read::DecoderReader::new(&mut f_in, base64::STANDARD);
        let mut result = Vec::new();
        decoder.read_to_end(&mut result)?;

        let mut out_file: Vec<async_std::fs::File> = Vec::default();
        check_and_create_file(&dest_file_path, sanitize_filename::sanitize(&uri).as_str(), &mut out_file).await?;
        if let Some(ff) = out_file.get_mut(0) {
            AsyncWriteExt::write_all(ff, &result).await?;
            AsyncWriteExt::flush(ff).await?;
            AsyncWriteExt::close(ff).await?;
        }
    } else if !path.is_empty() && !uri.is_empty() {
        if Path::new(&tmp_file_path).exists().await {
            async_std::fs::create_dir_all(&dest_file_path).await.unwrap();
            debug!("ren file {} <- {}", file_full_name, tmp_file_path);
            if let Err(e) = async_fs::rename(tmp_file_path.clone(), file_full_name).await {
                error!("{:?}", e);
                return Ok(HttpResponse::InternalServerError().into());
            }
        } else {
            warn!("write empty file {}", file_full_name);
            async_fs::write(file_full_name, "").await?;
        }
    }

    Ok(HttpResponse::Ok().into())
}
