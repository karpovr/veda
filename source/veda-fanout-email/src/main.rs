#[macro_use]
extern crate log;

use lettre::smtp::authentication::{Credentials, Mechanism};
use lettre::smtp::ConnectionReuseParameters;
use lettre::{ClientSecurity, SmtpClient, SmtpTransport, Transport};
use lettre_email::mime::IMAGE_JPEG;
use lettre_email::{Email, Mailbox};
use std::collections::HashMap;
use std::path::Path;
use v_api::app::ResultCode;
use v_module::info::ModuleInfo;
use v_module::module::*;
use v_module::onto::load_onto;
use v_onto::individual::*;
use v_onto::onto::Onto;
use v_queue::consumer::*;
use v_search::common::FTQuery;

const ATTACHMENTS_DB_PATH: &str = "data/files";

pub struct Context {
    onto: Onto,
    smtp_client: Option<SmtpTransport>,
    default_mail_sender: String,
    always_use_mail_sender: bool,
    sys_ticket: String,
}

fn main() -> Result<(), i32> {
    init_log("FANOUT_EMAIL");

    wait_load_ontology();

    let mut queue_consumer = Consumer::new("./data/queue", "fanout_email0", "individuals-flow").expect("!!!!!!!!! FAIL QUEUE");

    let module_info = ModuleInfo::new("./data", "fanout_email0", true);
    if module_info.is_err() {
        error!("{:?}", module_info.err());
        return Err(-1);
    }

    let mut module = Module::default();
    let systicket = module.get_sys_ticket_id();

    let mut ctx = Context {
        onto: Onto::default(),
        smtp_client: None,
        default_mail_sender: String::default(),
        always_use_mail_sender: false,
        sys_ticket: systicket.unwrap_or_default(),
    };

    connect_to_smtp(&mut ctx, &mut module);

    info!("load onto start");
    load_onto(&mut module.storage, &mut ctx.onto);
    info!("load onto end");

    module.listen_queue(
        &mut queue_consumer,
        &mut module_info.unwrap(),
        &mut ctx,
        &mut (before_batch as fn(&mut Module, &mut Context, size_batch: u32) -> Option<u32>),
        &mut (prepare as fn(&mut Module, &mut ModuleInfo, &mut Context, &mut Individual, my_consumer: &Consumer) -> Result<bool, PrepareError>),
        &mut (after_batch as fn(&mut Module, &mut ModuleInfo, &mut Context, prepared_batch_size: u32) -> Result<bool, PrepareError>),
        &mut (heartbeat as fn(&mut Module, &mut ModuleInfo, &mut Context) -> Result<(), PrepareError>),
    );
    Ok(())
}

fn heartbeat(_module: &mut Module, _module_info: &mut ModuleInfo, _ctx: &mut Context) -> Result<(), PrepareError> { Ok (()) }

fn before_batch(_module: &mut Module, _ctx: &mut Context, _size_batch: u32) -> Option<u32> {
    None
}

fn after_batch(_module: &mut Module, _module_info: &mut ModuleInfo, _ctx: &mut Context, _prepared_batch_size: u32) -> Result<bool, PrepareError> {
    Ok (false)
}

fn prepare(module: &mut Module, module_info: &mut ModuleInfo, ctx: &mut Context, queue_element: &mut Individual, _my_consumer: &Consumer) -> Result<bool, PrepareError> {
    let cmd = get_cmd(queue_element);
    if cmd.is_none() {
        error!("cmd is none");
        return Ok(true);
    }

    let op_id = queue_element.get_first_integer("op_id").unwrap_or_default();

    let mut prev_state = Individual::default();
    get_inner_binobj_as_individual(queue_element, "prev_state", &mut prev_state);

    let mut new_state = Individual::default();
    get_inner_binobj_as_individual(queue_element, "new_state", &mut new_state);

    if let Err(e) = module_info.put_info(op_id, op_id) {
        error!("fail write module_info, op_id={}, err={:?}", op_id, e)
    }

    if let Some(types) = new_state.get_literals("rdf:type") {
        let is_version = types.contains(&"v-s:Version".to_owned());
        if is_version {
            info!("{} is version, ignore", new_state.get_id());
            return Ok(true);
        }

        for itype in types {
            if ctx.onto.is_some_entered(&itype, &["v-s:Deliverable"]) {
                prepare_deliverable(&mut new_state, module, ctx);
                break;
            }
        }
    }

    Ok(true)
}

fn prepare_deliverable(prepared_indv: &mut Individual, module: &mut Module, ctx: &mut Context) -> ResultCode {
    let is_deleted = prepared_indv.is_exists("v-s:deleted");

    if is_deleted {
        info!("new_indv {} is deleted, ignore it", prepared_indv.get_id());
        return ResultCode::Ok;
    }

    let is_draft_of = prepared_indv.get_first_literal("v-s:is_draft_of");

    if is_draft_of.is_some() {
        info!("new_indv {} is draft, ignore it", prepared_indv.get_id());
        return ResultCode::Ok;
    }

    let has_message_type = prepared_indv.get_first_literal("v-s:hasMessageType");

    let mut from = prepared_indv.get_first_literal("v-wf:from").unwrap_or_default();
    let to = prepared_indv.get_literals("v-wf:to").unwrap_or_default();
    let subject = prepared_indv.get_first_literal("v-s:subject");
    let reply_to = prepared_indv.get_literals("v-wf:replyTo");
    let message_body = prepared_indv.get_first_literal("v-s:messageBody");

    let sender_mailbox = prepared_indv.get_first_literal("v-s:senderMailbox").unwrap_or_default();
    let recipient_mailbox = prepared_indv.get_literals("v-s:recipientMailbox");
    let attachments = prepared_indv.get_literals("v-s:attachment");

    if from.is_empty() && sender_mailbox.is_empty() && !ctx.default_mail_sender.is_empty() {
        from = ctx.default_mail_sender.to_string();
    }

    if (!from.is_empty() || !sender_mailbox.is_empty() || !ctx.default_mail_sender.is_empty()) && (!to.is_empty() || recipient_mailbox.is_some()) {
        let mut email_from = Mailbox::new("".to_string());

        if ctx.always_use_mail_sender && !ctx.default_mail_sender.is_empty() && ctx.default_mail_sender.len() > 5 {
            info!("use default mail sender: {}", ctx.default_mail_sender);
            if !ctx.default_mail_sender.contains('@') {
                if let Some(r) = extract_email(&None, &ctx.default_mail_sender.to_string(), ctx, module).pop() {
                    email_from = r;
                } else {
                    error!("fail extract email from default_mail_sender {}", ctx.default_mail_sender);
                }
            } else {
                email_from = Mailbox::new(ctx.default_mail_sender.to_string());
            };
        } else {
            if !from.is_empty() {
                info!("extract [from], {}", from);
                if let Some(r) = extract_email(&None, &from, ctx, module).pop() {
                    email_from = r;
                }
            }

            if (email_from.address.is_empty() || email_from.address.len() < 5) && !ctx.default_mail_sender.is_empty() {
                let mut emails = extract_email(&None, &ctx.default_mail_sender.to_string(), ctx, module);
                if !emails.is_empty() {
                    email_from = emails.pop().unwrap();
                }
            }

            if (email_from.address.is_empty() || email_from.address.len() < 5) && !sender_mailbox.is_empty() {
                email_from = Mailbox::new(sender_mailbox);
            }
        }

        if email_from.name.is_none() {
            email_from.name = Some("Veda System".to_owned());
        }

        let mut rr_email_to_hash = HashMap::new();
        for elt in to {
            for r in extract_email(&has_message_type, &elt, ctx, module) {
                rr_email_to_hash.insert(r.address.to_owned(), r);
            }
        }

        for el in recipient_mailbox.unwrap_or_default() {
            rr_email_to_hash.insert(el.to_string(), Mailbox::new(el));
        }

        let mut rr_reply_to_hash = HashMap::new();
        for elt in reply_to.unwrap_or_default() {
            for r in extract_email(&has_message_type, &elt, ctx, module) {
                rr_reply_to_hash.insert(r.address.to_owned(), r);
            }
        }

        if !rr_email_to_hash.is_empty() {
            let mut email = Email::builder();

            for id in attachments.unwrap_or_default().iter() {
                if let Some(file_info) = module.get_individual(id, &mut Individual::default()) {
                    let path = file_info.get_first_literal("v-s:filePath");
                    let file_uri = file_info.get_first_literal("v-s:fileUri");
                    let file_name = file_info.get_first_literal("v-s:fileName");

                    if path.is_some() && file_uri.is_some() && file_name.is_some() {
                        let mut path = path.unwrap();
                        if !path.is_empty() {
                            path += "/";
                            let full_path = ATTACHMENTS_DB_PATH.to_owned() + path.as_ref() + &file_uri.unwrap();

                            match email.clone().attachment_from_file(Path::new(&full_path), Some(&file_name.unwrap_or_default()), &IMAGE_JPEG) {
                                Ok(att) => email = att,
                                Err(e) => error!("fail add attachment {} into email {}, err={}", &full_path, prepared_indv.get_id(), e),
                            }
                        }
                    }
                }
            }

            email = email.from(email_from);

            for el in rr_email_to_hash.values() {
                email = email.to(el.clone());
            }

            if let Some(s) = subject {
                email = email.subject(s);
            }

            if let Some(s) = message_body {
                let sl = s.to_lowercase();
                if sl.contains("<html>") && sl.contains("</html>") {
                    email = email.html(s);
                } else {
                    email = email.text(s);
                }
            }

            match email.build() {
                Ok(m) => {
                    if let Some(mailer) = &mut ctx.smtp_client {
                        if let Err(e) = &mailer.send(m.into()) {
                            error!("fail send email id={}, err={}", prepared_indv.get_id(), e);
                        } else {
                            info!("message {} success send", prepared_indv.get_id());
                        }
                    } else {
                        error!("fail send email id={}, mailer not found", prepared_indv.get_id());
                    }
                }
                Err(e) => {
                    error!("fail build email id={}, err={}", prepared_indv.get_id(), e);
                }
            }
        }
    } else {
        if from.is_empty() || from.len() < 5 {
            error!("push_to_smtp {}: empty or invalid field from {}", prepared_indv.get_id(), from);
        }

        if to.is_empty() {
            error!("push_to_smtp {}: empty or invalid field to", prepared_indv.get_id());
        }
    }

    ResultCode::InternalServerError
}

fn get_emails_from_appointment(has_message_type: &Option<String>, ap: &mut Individual, module: &mut Module) -> Vec<Mailbox> {
    if ap.any_exists("v-s:hasDelegationPurpose", &["d:delegate_Control"]) {
        return vec![];
    }

    let p_uri = ap.get_first_literal("v-s:employee").unwrap_or_default();
    if p_uri.is_empty() {
        return vec![];
    }

    let mut prs = Individual::default();
    if module.get_individual(&p_uri, &mut prs).is_none() {
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
            if let Some(preference) = module.get_individual(&preference_uri, &mut Individual::default()) {
                info!("for {} found preferences, has message type {}", p_uri, has_message_type);

                let mut need_send = true;
                if let Some(receive_message_types) = preference.get_literals("v-ui:rejectMessageType") {
                    for msg_type in receive_message_types.iter() {
                        info!("check preference {}", msg_type);
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
                    info!("decline send message");
                    return vec![];
                }
            }
        }
    }

    let ac_uri = prs.get_first_literal("v-s:hasAccount");
    if ac_uri.is_none() {
        return vec![];
    }

    if let Some(ac) = module.get_individual(&ac_uri.unwrap(), &mut Individual::default()) {
        if ac.is_exists_bool("v-s:deleted", true) {
            return vec![];
        }

        let mut res = vec![];
        for el in ac.get_literals("v-s:mailbox").unwrap_or_default() {
            res.push(Mailbox::new_with_name(label.to_string(), el));
        }

        res
    } else {
        return vec![];
    }
}

fn extract_email(has_message_type: &Option<String>, ap_id: &str, ctx: &mut Context, module: &mut Module) -> Vec<Mailbox> {
    let mut res = Vec::new();
    let label;
    if ap_id.is_empty() || ap_id.is_empty() {
        return vec![];
    }

    if let Some(indv) = module.get_individual(ap_id, &mut Individual::default()) {
        label = indv.get_first_literal("rdfs:label").unwrap_or_default();

        if indv.any_exists("rdf:type", &["v-s:Appointment"]) {
            return get_emails_from_appointment(&has_message_type, indv, module);
        } else if indv.any_exists("rdf:type", &["v-s:Position"]) {
            let l_individuals = module
                .fts
                .query(FTQuery::new_with_ticket(&ctx.sys_ticket, &("'rdf:type' == 'v-s:Appointment' && 'v-s:occupation' == '".to_string() + indv.get_id() + "'")));

            for id in l_individuals.result {
                if let Some(individual) = module.get_individual(&id, &mut Individual::default()) {
                    if !individual.is_exists_bool("v-s:deleted", true) {
                        res.append(&mut get_emails_from_appointment(has_message_type, individual, module));
                    }
                }
            }
        } else if indv.any_exists("rdf:type", &["v-s:Person"]) {
            for ac_uri in indv.get_literals("v-s:hasAccount").unwrap_or_default() {
                if ac_uri.is_empty() {
                    return vec![];
                }

                if let Some(ac) = module.get_individual(&ac_uri, &mut Individual::default()) {
                    if !ac.is_exists_bool("v-s:delete", true) {
                        for el in ac.get_literals("v-s:mailbox").unwrap_or_default() {
                            res.push(Mailbox::new_with_name(label.to_owned(), el));
                        }
                        return res;
                    }
                }
            }
        } else {
            error!("extract_email: fail extract email from {}, this not appointment or position", ap_id);
        }
    }
    res
}

fn connect_to_smtp(ctx: &mut Context, module: &mut Module) -> bool {
    if let Some(node) = module.get_individual("cfg:standart_node", &mut Individual::default()) {
        if let Some(v) = node.get_literals("v-s:send_an_email_individual_by_event") {
            for el in v {
                let mut connection = Individual::default();

                if module.storage.get_individual(&el, &mut connection) && !connection.is_exists_bool("v-s:delete", true) {
                    if let Some(transport) = connection.get_first_literal("v-s:transport") {
                        if transport == "smtp" {
                            info!("found connect to smtp {}", connection.get_id());

                            let host = connection.get_first_literal("v-s:host").unwrap_or_default();
                            let port = connection.get_first_integer("v-s:port").unwrap_or(25);

                            if host.is_empty() {
                                error!("param [host] is empty");
                                return false;
                            }

                            let login = connection.get_first_literal("v-s:login");
                            let pass = connection.get_first_literal("v-s:password");
                            let use_smtp_utf8 = connection.get_first_bool("cfg:use_smtp_utf8").unwrap_or(true);

                            ctx.default_mail_sender = connection.get_first_literal("v-s:mailSender").unwrap_or_default();
                            ctx.always_use_mail_sender = connection.get_first_bool("v-s:alwaysUseMailSender").unwrap_or_default();

                            if ctx.always_use_mail_sender {
                                info!("use always_use_mail_sender");
                            }

                            if !ctx.default_mail_sender.is_empty() {
                                info!("default mail sender: {:?}", ctx.default_mail_sender);
                            }

                            let client = SmtpClient::new(host.to_owned() + ":" + &port.to_string(), ClientSecurity::None);
                            if let Err(e) = client {
                                error!("fail connect to {}:{}, err={}", host, port, e);
                                return false;
                            }

                            if login.is_some() && pass.is_some() {
                                let auth_type = match connection.get_first_literal("v-s:authType").unwrap_or_default().as_str() {
                                    "PLAIN" => Mechanism::Plain,
                                    "LOGIN" => Mechanism::Login,
                                    _ => Mechanism::Plain,
                                };

                                // connect with auth
                                ctx.smtp_client = Some(
                                    client
                                        .unwrap()
                                        .credentials(Credentials::new(login.unwrap(), pass.unwrap()))
                                        .smtp_utf8(use_smtp_utf8)
                                        .authentication_mechanism(auth_type)
                                        .connection_reuse(ConnectionReuseParameters::ReuseUnlimited)
                                        .transport(),
                                );
                                return true;
                            } else {
                                // no security connect
                                ctx.smtp_client = Some(client.unwrap().smtp_utf8(use_smtp_utf8).transport());
                                return true;
                            }
                        }
                    }
                }
            }
        }
    }

    error!("not found configuration for connection to smtp server");
    false
}
