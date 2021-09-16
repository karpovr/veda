use crate::auth::TicketCache;
use crate::common::{check_ticket, get_individual_from_db, get_ticket};
use crate::Storage;
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
use base64::decode;
use chrono::{DateTime, NaiveDateTime, Utc};
use filetime::FileTime;
use futures::{AsyncWriteExt, StreamExt, TryStreamExt};
use std::sync::Mutex;
use v_common::az_impl::az_lmdb::LmdbAzContext;
use v_common::v_api::obj::ResultCode;

#[get("/files/{file_id}")]
pub(crate) async fn load_file(
    ticket_cache: web::Data<TicketCache>,
    db: web::Data<Storage>,
    az: web::Data<Mutex<LmdbAzContext>>,
    req: HttpRequest,
) -> io::Result<HttpResponse> {
    let (res, user_uri) = check_ticket(&get_ticket(&req, &None), &ticket_cache, &db).await?;
    if res != ResultCode::Ok {
        return Ok(HttpResponse::new(StatusCode::from_u16(res as u16).unwrap()));
    }

    if let Some(file_id) = req.path().strip_prefix("/files/") {
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

async fn check_and_create_file(path: &str, uri: &str, f: &mut Vec<async_std::fs::File>) -> io::Result<()> {
    if !path.is_empty() && !uri.is_empty() && f.is_empty() {
        async_std::fs::create_dir_all(format!("./data/files/{}", &path)).await?;
        f.push(async_std::fs::File::create(format!("./data/files/{}/{}", path, sanitize_filename::sanitize(&uri))).await?);
    }
    Ok(())
}

pub(crate) async fn save_file(mut payload: Multipart) -> ActixResult<impl Responder> {
    let mut path = String::new();
    let mut uri = String::new();
    let mut f: Vec<async_std::fs::File> = Vec::default();

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
                        if let Ok(buf) = &chunk {
                            check_and_create_file(&path, &uri, &mut f).await?;
                            if let Some(ff) = f.get_mut(0) {
                                AsyncWriteExt::write_all(ff, buf).await?;
                            }
                        }
                    }
                    "content" => {
                        let cur_chunk = &chunk?;

                        if f.is_empty() {
                            let mut pos = 0;
                            for (idx, b) in cur_chunk.iter().enumerate() {
                                if b == &(b',') {
                                    pos = idx + 1;
                                    break;
                                }
                            }
                            if pos > 7 {
                                if let Ok(buf) = decode(cur_chunk.split_at(pos).1) {
                                    check_and_create_file(&path, &uri, &mut f).await?;
                                    if let Some(ff) = f.get_mut(0) {
                                        AsyncWriteExt::write_all(ff, &buf).await?;
                                    }
                                }
                            }
                        } else if let Ok(buf) = decode(cur_chunk) {
                            check_and_create_file(&path, &uri, &mut f).await?;
                            if let Some(ff) = f.get_mut(0) {
                                AsyncWriteExt::write_all(ff, &buf).await?;
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
    if let Some(ff) = f.get_mut(0) {
        AsyncWriteExt::flush(ff).await?;
    }

    Ok(HttpResponse::Ok())
}
