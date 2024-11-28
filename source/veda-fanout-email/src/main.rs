// use lettre 11
#[macro_use]
extern crate log;

use lettre::message::{header, Mailbox, MultiPart, SinglePart};
use lettre::transport::smtp::PoolConfig;
use lettre::{Address, Message, SmtpTransport, Transport};
use std::collections::HashMap;
use std::error::Error;
use std::str::FromStr;
use std::time::Duration;
use v_common::module::common::load_onto;
use v_common::module::info::ModuleInfo;
use v_common::module::module_impl::{get_cmd, get_inner_binobj_as_individual, init_log, wait_load_ontology, Module, PrepareError};
use v_common::module::veda_backend::Backend;
use v_common::onto::individual::Individual;
use v_common::onto::onto_impl::Onto;
use v_common::search::common::FTQuery;
use v_common::v_api::obj::ResultCode;
use v_common::v_queue::consumer::Consumer;

const ATTACHMENTS_DB_PATH: &str = "data/files";

pub struct Context {
    onto: Onto,
    smtp_client: Option<SmtpTransport>,
    default_mail_sender: String,
    always_use_mail_sender: bool,
    sys_ticket: String,
    module_info: ModuleInfo,
}

fn main() -> Result<(), i32> {
    init_log("FANOUT_EMAIL");

    wait_load_ontology();

    let mut queue_consumer = Consumer::new("./data/queue", "fanout_email0", "individuals-flow").expect("!!!!!!!!! FAIL QUEUE");

    let module_info = ModuleInfo::new("./data", "fanout_email0", true);
    if module_info.is_err() {
        error!("failed to start, err = {:?}", &module_info.err());
        return Err(-1);
    }

    let mut module = Module::default();
    let mut backend = Backend::default();
    let systicket = backend.get_sys_ticket_id();

    let mut ctx = Context {
        onto: Onto::default(),
        smtp_client: None,
        default_mail_sender: String::default(),
        always_use_mail_sender: false,
        sys_ticket: systicket.unwrap_or_default(),
        module_info: module_info.unwrap(),
    };

    connect_to_smtp(&mut ctx, &mut backend);

    info!("load ontology start");
    load_onto(&mut backend.storage, &mut ctx.onto);
    info!("load ontology end");

    module.listen_queue(
        &mut queue_consumer,
        &mut ctx,
        &mut (before_batch as fn(&mut Backend, &mut Context, size_batch: u32) -> Option<u32>),
        &mut (prepare as fn(&mut Backend, &mut Context, &mut Individual, my_consumer: &Consumer) -> Result<bool, PrepareError>),
        &mut (after_batch as fn(&mut Backend, &mut Context, prepared_batch_size: u32) -> Result<bool, PrepareError>),
        &mut (heartbeat as fn(&mut Backend, &mut Context) -> Result<(), PrepareError>),
        &mut backend,
    );
    Ok(())
}

fn heartbeat(_module: &mut Backend, _ctx: &mut Context) -> Result<(), PrepareError> {
    Ok(())
}

fn before_batch(_module: &mut Backend, _ctx: &mut Context, _size_batch: u32) -> Option<u32> {
    None
}

fn after_batch(_module: &mut Backend, _ctx: &mut Context, _prepared_batch_size: u32) -> Result<bool, PrepareError> {
    Ok(false)
}

fn prepare(backend: &mut Backend, ctx: &mut Context, queue_element: &mut Individual, _my_consumer: &Consumer) -> Result<bool, PrepareError> {
    let cmd = get_cmd(queue_element);
    if cmd.is_none() {
        error!("skip queue message: cmd is none");
        return Ok(true);
    }

    let op_id = queue_element.get_first_integer("op_id").unwrap_or_default();

    let mut prev_state = Individual::default();
    get_inner_binobj_as_individual(queue_element, "prev_state", &mut prev_state);

    let mut new_state = Individual::default();
    get_inner_binobj_as_individual(queue_element, "new_state", &mut new_state);

    if let Err(e) = ctx.module_info.put_info(op_id, op_id) {
        error!("failed to write module_info, op_id = {}, err = {:?}", op_id, e)
    }

    if let Some(types) = new_state.get_literals("rdf:type") {
        let is_version = types.contains(&"v-s:Version".to_owned());
        if is_version {
            info!("individual {} is version, ignore", new_state.get_id());
            return Ok(true);
        }

        for itype in types {
            if ctx.onto.is_some_entered(&itype, &["v-s:Deliverable"]) {
                prepare_deliverable(&mut new_state, backend, ctx);
                break;
            }
        }
    }

    Ok(true)
}

struct IndvAddreses {
    has_message_type: Option<String>,
    from: String,
    to: Vec<String>,
    //reply_to: Option<Vec<String>>,
    sender_mailbox: String,
    recipient_mailbox: Option<Vec<String>>,
}

impl IndvAddreses {
    // Создаем метод для заполнения структуры из объекта `prepared_indv`
    fn from_prepared_individual(prepared_indv: &mut Individual, ctx: &mut Context) -> Self {
        let mut from = prepared_indv.get_first_literal("v-wf:from").unwrap_or_default();
        let sender_mailbox = prepared_indv.get_first_literal("v-s:senderMailbox").unwrap_or_default();
        if from.is_empty() && sender_mailbox.is_empty() && !ctx.default_mail_sender.is_empty() {
            from = ctx.default_mail_sender.to_string();
        }

        IndvAddreses {
            has_message_type: prepared_indv.get_first_literal("v-s:hasMessageType"),
            from,
            to: prepared_indv.get_literals("v-wf:to").unwrap_or_default(),
            //reply_to: prepared_indv.get_literals("v-wf:replyTo"),
            sender_mailbox,
            recipient_mailbox: prepared_indv.get_literals("v-s:recipientMailbox"),
        }
    }
}

struct MailAddreses {
    email_from: Mailbox,
    rr_email_to_hash: HashMap<String, Mailbox>,
    //rr_reply_to_hash: HashMap<String, Mailbox>
}

impl MailAddreses {
    fn from_indv_addreses(message_info: IndvAddreses, backend: &mut Backend, ctx: &mut Context) -> Self {
        let empty_address = Address::new("postmaster", "localhost").expect("Failed to create empty address");
        let mut email_from = Mailbox::new(None, empty_address);

        if ctx.always_use_mail_sender && !ctx.default_mail_sender.is_empty() && ctx.default_mail_sender.len() > 5 {
            info!("use default mail sender: {}", ctx.default_mail_sender);
            if !ctx.default_mail_sender.contains('@') {
                if let Some(r) = extract_email(&None, &ctx.default_mail_sender.to_string(), ctx, backend).pop() {
                    email_from = r;
                } else {
                    error!("failed to extract email from default_mail_sender {}", ctx.default_mail_sender);
                }
            } else {
                if let Ok(address) = Address::from_str(&ctx.default_mail_sender) {
                    email_from = Mailbox::new(Some("Veda System".to_string()), address);
                }
            };
        } else {
            if !message_info.from.is_empty() {
                info!("extract from: {}", message_info.from);
                if let Some(r) = extract_email(&None, &message_info.from, ctx, backend).pop() {
                    email_from = r;
                }
            }

            if email_from.email.to_string().is_empty() && !ctx.default_mail_sender.is_empty() {
                let mut emails = extract_email(&None, &ctx.default_mail_sender.to_string(), ctx, backend);
                if !emails.is_empty() {
                    email_from = emails.pop().unwrap();
                }
            }

            if email_from.email.to_string().is_empty() && !message_info.sender_mailbox.is_empty() {
                if let Ok(address) = Address::from_str(&message_info.sender_mailbox) {
                    email_from = Mailbox::new(Some("Veda System".to_string()), address);
                }
            }
        }

        let mut rr_email_to_hash = HashMap::new();
        for elt in message_info.to {
            for r in extract_email(&message_info.has_message_type, &elt, ctx, backend) {
                rr_email_to_hash.insert(r.email.to_string(), r);
            }
        }

        for el in message_info.recipient_mailbox.unwrap_or_default() {
            if let Ok(address) = Address::from_str(&el) {
                rr_email_to_hash.insert(el.to_string(), Mailbox::new(Some("Recipient".to_string()), address));
            }
        }

        //let mut rr_reply_to_hash = HashMap::new();
        //for elt in message_info.reply_to.unwrap_or_default() {
        //    for r in extract_email(&message_info.has_message_type, &elt, ctx, backend) {
        //        rr_reply_to_hash.insert(r.address.to_owned(), r);
        //    }
        //}
        MailAddreses {
            email_from,
            rr_email_to_hash,
            //rr_reply_to_hash,
        }
    }
}

fn prepare_deliverable(msg_indv: &mut Individual, backend: &mut Backend, ctx: &mut Context) -> ResultCode {
    // Проверяем нужно ли подробное логирование
    let debug_logging = msg_indv.is_exists("v-s:debugEmail");

    if debug_logging {
        info!("Starting to prepare deliverable for {}", msg_indv.get_id());
    }

    let is_deleted = msg_indv.is_exists("v-s:deleted");
    if is_deleted {
        if debug_logging {
            info!("Individual {} is deleted, ignore", msg_indv.get_id());
        }
        return ResultCode::Ok;
    }

    let is_draft_of = msg_indv.get_first_literal("v-s:is_draft_of");
    if is_draft_of.is_some() {
        if debug_logging {
            info!("Individual {} is draft, ignore", msg_indv.get_id());
        }
        return ResultCode::Ok;
    }

    let subject = msg_indv.get_first_literal("v-s:subject");
    let message_body = msg_indv.get_first_literal("v-s:messageBody");
    let attachments = msg_indv.get_literals("v-s:attachment");

    if debug_logging {
        info!(
            "Email details for {}: subject={:?}, has_body={}, attachment_count={:?}",
            msg_indv.get_id(),
            subject,
            message_body.is_some(),
            attachments.as_ref().map(|a| a.len())
        );
    }

    let message_info = IndvAddreses::from_prepared_individual(msg_indv, ctx);

    if debug_logging {
        info!(
            "Address details for {}: from={}, to_count={}, has_sender_mailbox={}, recipient_mailbox_count={:?}",
            msg_indv.get_id(),
            message_info.from,
            message_info.to.len(),
            !message_info.sender_mailbox.is_empty(),
            message_info.recipient_mailbox.as_ref().map(|r| r.len())
        );
    }

    if (!message_info.from.is_empty() || !message_info.sender_mailbox.is_empty() || !ctx.default_mail_sender.is_empty())
        && (!message_info.to.is_empty() || message_info.recipient_mailbox.is_some())
    {
        let mail_addreses = MailAddreses::from_indv_addreses(message_info, backend, ctx);

        if debug_logging {
            info!("Resolved email addresses for {}: from={}, to_count={}", msg_indv.get_id(), mail_addreses.email_from.email, mail_addreses.rr_email_to_hash.len());
        }

        if !mail_addreses.rr_email_to_hash.is_empty() {
            let mut message_builder = Message::builder().from(mail_addreses.email_from.clone()).header(header::ContentTransferEncoding::QuotedPrintable);

            for el in mail_addreses.rr_email_to_hash.values() {
                message_builder = message_builder.to(el.clone());
                if debug_logging {
                    info!("Adding recipient for {}: {}", msg_indv.get_id(), el.email);
                }
            }

            if let Some(s) = subject.clone() {
                message_builder = message_builder.subject(s);
            }

            // Собираем сообщение в зависимости от наличия вложений
            let email = if attachments.is_some() {
                if debug_logging {
                    info!("Processing attachments for {}", msg_indv.get_id());
                }
                let mut builder = MultiPart::mixed().build();

                // Добавляем тело письма
                if let Some(ref body) = message_body {
                    let is_html = body.to_lowercase().contains("<html>");
                    if debug_logging {
                        info!(
                            "Adding message body for {}, content type: {}",
                            msg_indv.get_id(),
                            if is_html {
                                "text/html"
                            } else {
                                "text/plain"
                            }
                        );
                    }

                    let body_part = if is_html {
                        SinglePart::builder()
                            .header(header::ContentType::parse("text/html; charset=utf-8").unwrap())
                            .header(header::ContentTransferEncoding::QuotedPrintable)
                            .body(body.clone())
                    } else {
                        SinglePart::builder()
                            .header(header::ContentType::parse("text/plain; charset=utf-8").unwrap())
                            .header(header::ContentTransferEncoding::QuotedPrintable)
                            .body(body.clone())
                    };
                    builder = builder.singlepart(body_part);
                }

                // Добавляем вложения
                for id in attachments.clone().unwrap().iter() {
                    if debug_logging {
                        info!("Processing attachment {} for {}", id, msg_indv.get_id());
                    }
                    if let Some(file_info) = backend.get_individual(id, &mut Individual::default()) {
                        if let (Some(path), Some(file_uri), Some(file_name)) =
                            (file_info.get_first_literal("v-s:filePath"), file_info.get_first_literal("v-s:fileUri"), file_info.get_first_literal("v-s:fileName"))
                        {
                            if !path.is_empty() {
                                let full_path = format!("{}/{}/{}", ATTACHMENTS_DB_PATH, path, file_uri);
                                if debug_logging {
                                    info!("Reading attachment from {}", full_path);
                                }

                                match std::fs::read(&full_path) {
                                    Ok(content) => {
                                        let mime = mime_guess::from_path(&file_name).first_or_octet_stream();
                                        let mime_str = mime.essence_str().to_string();
                                        if debug_logging {
                                            info!("Attachment {} mime type: {}", file_name, mime_str);
                                        }

                                        let content_type = header::ContentType::parse(&mime_str).unwrap_or_else(|_| {
                                            if debug_logging {
                                                warn!("Failed to parse mime type {}, using octet-stream", mime_str);
                                            }
                                            header::ContentType::parse("application/octet-stream").unwrap()
                                        });

                                        let attachment = SinglePart::builder()
                                            .header(content_type)
                                            .header(header::ContentDisposition::attachment(&file_name))
                                            .header(header::ContentTransferEncoding::Base64)
                                            .body(content);

                                        builder = builder.singlepart(attachment);
                                        if debug_logging {
                                            info!("Successfully added attachment {}", file_name);
                                        }
                                    },
                                    Err(e) => {
                                        error!("Failed to read attachment {} for email {}, err = {:?}", &full_path, msg_indv.get_id(), e);
                                    },
                                }
                            }
                        }
                    }
                }

                message_builder.multipart(builder)
            } else if let Some(ref body) = message_body {
                let is_html = body.to_lowercase().contains("<html>");
                if debug_logging {
                    info!(
                        "Creating single part message for {}, content type: {}",
                        msg_indv.get_id(),
                        if is_html {
                            "text/html"
                        } else {
                            "text/plain"
                        }
                    );
                }

                if is_html {
                    message_builder
                        .header(header::ContentType::parse("text/html; charset=utf-8").unwrap())
                        .header(header::ContentTransferEncoding::QuotedPrintable)
                        .body(body.clone())
                } else {
                    message_builder
                        .header(header::ContentType::parse("text/plain; charset=utf-8").unwrap())
                        .header(header::ContentTransferEncoding::QuotedPrintable)
                        .body(body.clone())
                }
            } else {
                if debug_logging {
                    info!("Creating empty message for {}", msg_indv.get_id());
                }
                message_builder
                    .header(header::ContentType::parse("text/plain; charset=utf-8").unwrap())
                    .header(header::ContentTransferEncoding::QuotedPrintable)
                    .body(String::new())
            };

            match email {
                Ok(email) => {
                    if let Some(mailer) = &ctx.smtp_client {
                        if debug_logging {
                            info!("Attempting to send email for {}", msg_indv.get_id());
                        }
                        match mailer.send(&email) {
                            Ok(response) => {
                                // Извлекаем message_id из ответа SMTP сервера
                                let message_id = response.message().collect::<Vec<_>>().first().and_then(|msg| {
                                    if let Some(start) = msg.find('<') {
                                        if let Some(end) = msg[start..].find('>') {
                                            Some(&msg[start..start + end + 1])
                                        } else {
                                            None
                                        }
                                    } else {
                                        None
                                    }
                                });

                                // Базовый лог для любого случая
                                info!(
                                    "Email sent: from={}, to={:?}, smtp_code={}, message_id={}",
                                    mail_addreses.email_from.email,
                                    mail_addreses.rr_email_to_hash.values().map(|m| m.email.to_string()).collect::<Vec<_>>(),
                                    response.code(),
                                    message_id.unwrap_or("unknown")
                                );

                                if debug_logging {
                                    info!("Full SMTP server response: {:?}", response);
                                }
                                return ResultCode::Ok;
                            },
                            Err(e) => {
                                error!("Failed to send email, uri = {}, error details: {:?}", msg_indv.get_id(), e);

                                // Определяем тип ошибки и выводим соответствующую информацию
                                if e.is_permanent() {
                                    if let Some(code) = e.status() {
                                        error!("Permanent SMTP error with code {}: {}", code, e);
                                    } else {
                                        error!("Permanent SMTP error without code: {}", e);
                                    }
                                    error!("This error cannot be resolved by retrying");
                                } else if e.is_transient() {
                                    if let Some(code) = e.status() {
                                        error!("Transient SMTP error with code {}: {}", code, e);
                                    } else {
                                        error!("Transient SMTP error without code: {}", e);
                                    }
                                    error!("This error might be resolved by retrying later");
                                } else if e.is_client() {
                                    error!("SMTP client error: {}", e);
                                } else if e.is_response() {
                                    error!("SMTP response error: {}", e);
                                } else if e.is_timeout() {
                                    error!("SMTP timeout error: {}", e);
                                }

                                // Выводим информацию об исходной ошибке, если она есть
                                if let Some(source) = e.source() {
                                    error!("Underlying error: {}", source);
                                    if let Some(io_err) = source.downcast_ref::<std::io::Error>() {
                                        error!("IO error kind: {:?}", io_err.kind());
                                        if let Some(os_err) = io_err.raw_os_error() {
                                            error!("OS error code: {}", os_err);
                                        }
                                    }
                                }

                                // Логируем контекст отправки
                                error!(
                                    "Email context: from={}, to={:?}, subject={:?}",
                                    mail_addreses.email_from.email,
                                    mail_addreses.rr_email_to_hash.values().map(|m| m.email.to_string()).collect::<Vec<_>>(),
                                    subject
                                );
                            },
                        }
                    } else {
                        error!("Failed to send email, mailer not found, uri = {}", msg_indv.get_id());
                    }
                },
                Err(e) => {
                    error!("Failed to build email, id = {}, error: {}", msg_indv.get_id(), e);
                    error!(
                        "Email configuration: from={}, to_count={}, has_subject={}, has_body={}, has_attachments={}",
                        mail_addreses.email_from.email,
                        mail_addreses.rr_email_to_hash.len(),
                        subject.is_some(),
                        message_body.is_some(),
                        attachments.is_some()
                    );
                },
            }
        } else {
            error!("No valid recipients found for {}", msg_indv.get_id());
        }
    } else {
        if message_info.from.is_empty() || message_info.from.len() < 5 {
            error!("Failed to send email, empty or invalid field from, uri = {}, from = {}", msg_indv.get_id(), message_info.from);
        }

        if message_info.to.is_empty() {
            error!("Failed to send email, empty or invalid field to, uri = {}", msg_indv.get_id());
        }
    }

    ResultCode::InternalServerError
}

fn get_emails_from_appointment(has_message_type: &Option<String>, ap: &mut Individual, backend: &mut Backend) -> Vec<Mailbox> {
    if ap.any_exists("v-s:hasDelegationPurpose", &["d:delegate_Control"]) {
        return vec![];
    }

    let p_uri = ap.get_first_literal("v-s:employee").unwrap_or_default();
    if p_uri.is_empty() {
        return vec![];
    }

    let mut prs = Individual::default();
    if backend.get_individual(&p_uri, &mut prs).is_none() {
        return vec![];
    }

    if let Some(v) = prs.get_first_bool("v-s:deleted") {
        if v {
            return vec![];
        }
    }

    let label = ap.get_first_literal("rdfs:label").unwrap_or_default();

    if let Some(has_message_type) = has_message_type {
        if let Some(preference_uri) = prs.get_first_literal("v-ui:hasPreferences") {
            if let Some(preference) = backend.get_individual(&preference_uri, &mut Individual::default()) {
                info!("found preferences, uri = {}, has message type = {}", p_uri, has_message_type);

                let mut need_send = true;
                if let Some(receive_message_types) = preference.get_literals("v-ui:rejectMessageType") {
                    for msg_type in receive_message_types.iter() {
                        info!("check preferences {}", msg_type);
                        if !has_message_type.is_empty() && msg_type == has_message_type {
                            need_send = false;
                            break;
                        }

                        if !has_message_type.is_empty() && msg_type == "v-s:OtherNotification" {
                            need_send = false;
                            break;
                        }
                    }
                }

                if !need_send {
                    info!("declined to send message");
                    return vec![];
                }
            }
        }
    }

    let ac_uri = prs.get_first_literal("v-s:hasAccount");
    if ac_uri.is_none() {
        return vec![];
    }

    if let Some(ac) = backend.get_individual(&ac_uri.unwrap(), &mut Individual::default()) {
        if ac.is_exists_bool("v-s:deleted", true) {
            return vec![];
        }

        let mut res = vec![];
        for el in ac.get_literals("v-s:mailbox").unwrap_or_default() {
            if let Ok(address) = Address::from_str(&el) {
                res.push(Mailbox::new(Some(label.clone()), address));
            } else if let Some((user, domain)) = split_email_address(&el) {
                if let Ok(address) = Address::new(user, domain) {
                    res.push(Mailbox::new(Some(label.clone()), address));
                } else {
                    error!("failed to create email address: {}", el);
                }
            } else {
                error!("invalid email format: {}", el);
            }
        }
        res
    } else {
        vec![]
    }
}

fn extract_email(has_message_type: &Option<String>, ap_id: &str, ctx: &mut Context, backend: &mut Backend) -> Vec<Mailbox> {
    let mut res = Vec::new();

    if ap_id.is_empty() {
        return vec![];
    }

    if let Some(indv) = backend.get_individual(ap_id, &mut Individual::default()) {
        let label = indv.get_first_literal("rdfs:label").unwrap_or_default();

        if indv.any_exists("rdf:type", &["v-s:Appointment"]) {
            return get_emails_from_appointment(has_message_type, indv, backend);
        } else if indv.any_exists("rdf:type", &["v-s:Position"]) {
            let l_individuals = backend
                .fts
                .query(FTQuery::new_with_ticket(&ctx.sys_ticket, &("'rdf:type' == 'v-s:Appointment' && 'v-s:occupation' == '".to_string() + indv.get_id() + "'")));

            for id in l_individuals.result {
                if let Some(individual) = backend.get_individual(&id, &mut Individual::default()) {
                    if !individual.is_exists_bool("v-s:deleted", true) {
                        res.append(&mut get_emails_from_appointment(has_message_type, individual, backend));
                    }
                }
            }
        } else if indv.any_exists("rdf:type", &["v-s:Person"]) {
            for ac_uri in indv.get_literals("v-s:hasAccount").unwrap_or_default() {
                if ac_uri.is_empty() {
                    return vec![];
                }

                if let Some(ac) = backend.get_individual(&ac_uri, &mut Individual::default()) {
                    if !ac.is_exists_bool("v-s:delete", true) {
                        for el in ac.get_literals("v-s:mailbox").unwrap_or_default() {
                            if let Ok(address) = Address::from_str(&el) {
                                res.push(Mailbox::new(Some(label.clone()), address));
                            } else if let Some((user, domain)) = split_email_address(&el) {
                                if let Ok(address) = Address::new(user, domain) {
                                    res.push(Mailbox::new(Some(label.clone()), address));
                                } else {
                                    error!("failed to create email address: {}", el);
                                }
                            } else {
                                error!("invalid email format: {}", el);
                            }
                        }
                        return res;
                    }
                }
            }
        } else {
            error!("failed to extract email from {}, this is not an appointment, nor a position", ap_id);
        }
    }
    res
}

fn split_email_address(email: &str) -> Option<(String, String)> {
    let parts: Vec<&str> = email.split('@').collect();
    if parts.len() == 2 {
        Some((parts[0].to_string(), parts[1].to_string()))
    } else {
        None
    }
}

fn connect_to_smtp(ctx: &mut Context, module: &mut Backend) -> bool {
    if let Some(node) = module.get_individual("cfg:standart_node", &mut Individual::default()) {
        if let Some(v) = node.get_literals("v-s:send_an_email_individual_by_event") {
            for el in v {
                let mut connection = Individual::default();

                if module.storage.get_individual(&el, &mut connection) == ResultCode::Ok && !connection.is_exists_bool("v-s:delete", true) {
                    if let Some(transport) = connection.get_first_literal("v-s:transport") {
                        if transport == "smtp" {
                            info!("found connection configuration for smtp server, uri = {}", connection.get_id());

                            let host = connection.get_first_literal("v-s:host").unwrap_or_default();
                            let port = connection.get_first_integer("v-s:port").unwrap_or(25);

                            if host.is_empty() {
                                error!("parameter [host] is empty");
                                return false;
                            }

                            let login = connection.get_first_literal("v-s:login");
                            let pass = connection.get_first_literal("v-s:password");
                            let use_smtp_utf8 = connection.get_first_bool("cfg:use_smtp_utf8").unwrap_or(true);

                            ctx.default_mail_sender = connection.get_first_literal("v-s:mailSender").unwrap_or_default();
                            ctx.always_use_mail_sender = connection.get_first_bool("v-s:alwaysUseMailSender").unwrap_or_default();

                            // Формируем URL для SMTP
                            let mut url = String::new();

                            // Определяем протокол и порт по умолчанию
                            let (protocol, default_port) = match port {
                                465 => ("smtps://", 465),
                                587 => ("smtp://", 587),
                                _ => ("smtp://", 25),
                            };

                            url.push_str(protocol);

                            // Добавляем credentials и механизм аутентификации если есть
                            if let (Some(login), Some(pass)) = (&login, &pass) {
                                let auth_mechanism = match connection.get_first_literal("v-s:authType").unwrap_or_default().as_str() {
                                    "PLAIN" => "AUTH=PLAIN",
                                    "LOGIN" => "AUTH=LOGIN",
                                    _ => "AUTH=PLAIN",
                                };

                                url.push_str(&urlencoding::encode(login));
                                url.push(':');
                                url.push_str(&urlencoding::encode(pass));
                                url.push('@');

                                if port != default_port {
                                    url.push_str(&host);
                                    url.push(':');
                                    url.push_str(&port.to_string());
                                } else {
                                    url.push_str(&host);
                                }

                                // Добавляем параметры
                                url.push('?');
                                url.push_str(auth_mechanism);

                                if port == 587 {
                                    url.push_str("&tls=required");
                                }

                                if use_smtp_utf8 {
                                    url.push_str("&utf8=yes");
                                }
                            } else {
                                url.push_str(&host);
                                if port != default_port {
                                    url.push(':');
                                    url.push_str(&port.to_string());
                                }

                                if port == 587 {
                                    url.push_str("?tls=required");
                                    if use_smtp_utf8 {
                                        url.push_str("&utf8=yes");
                                    }
                                } else if use_smtp_utf8 {
                                    url.push_str("?utf8=yes");
                                }
                            }

                            info!("Connecting to SMTP server with URL: {}", url);

                            // Создаем конфигурацию пула с разумными значениями по умолчанию
                            let pool_config = PoolConfig::new()
                                .max_size(20) // Максимум 20 соединений в пуле
                                .idle_timeout(Duration::from_secs(300)); // Таймаут простоя 5 минут

                            // Создаем транспорт
                            match SmtpTransport::from_url(&url) {
                                Ok(builder) => {
                                    let transport = builder
                                        .pool_config(pool_config)
                                        .timeout(Some(Duration::from_secs(10))) // Таймаут подключения 10 секунд
                                        .build();

                                    ctx.smtp_client = Some(transport);

                                    if ctx.always_use_mail_sender {
                                        info!("use always_use_mail_sender parameter");
                                    }
                                    if !ctx.default_mail_sender.is_empty() {
                                        info!("default mail sender = {:?}", ctx.default_mail_sender);
                                    }

                                    return true;
                                },
                                Err(e) => {
                                    error!("Failed to create SMTP transport from URL {}: {:?}", url, e);
                                    return false;
                                },
                            }
                        }
                    }
                }
            }
        }
    }

    error!("failed to find connection configuration for smtp server");
    false
}
