/// This module gives function to check access of user to individual
use core::fmt;
use std::collections::HashMap;

const PERMISSION_PREFIX: &str = "P";
pub const FILTER_PREFIX: &str = "F";
const MEMBERSHIP_PREFIX: &str = "M";
const M_IS_EXCLUSIVE: char = 'X';
const M_IGNORE_EXCLUSIVE: char = 'N';
static ACCESS_LIST: [u8; 4] = [1, 2, 4, 8];
static ACCESS_LIST_PREDICATES: [&str; 9] = ["", "v-s:canCreate", "v-s:canRead", "", "v-s:canUpdate", "", "", "", "v-s:canDelete"];

/// Битовые поля для прав
#[repr(u8)]
pub enum Access {
    /// Создание
    CanCreate = 1u8,

    /// Чтение
    CanRead = 2u8,

    /// Изменеие
    CanUpdate = 4u8,

    /// Удаление
    CanDelete = 8u8,

    /// Запрет создания
    CantCreate = 16u8,

    /// Запрет чтения
    CantRead = 32u8,

    /// Запрет обновления
    CantUpdate = 64u8,

    /// Запрет удаления
    CantDelete = 128u8,
}

pub struct Right {
    pub id: String,
    pub access: u8,
    marker: char,
    is_deleted: bool,
    level: u8,
}

pub trait Storage {
    fn get(&self, key: &str) -> Result<String, i64>;
    fn fiber_yield(&self);
}

impl fmt::Debug for Right {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "({}, {}, {}, {})", self.id, access_to_pretty_string(self.access), self.marker, self.level)
    }
}

pub struct Trace<'a> {
    pub acl: &'a mut String,
    pub is_acl: bool,

    pub group: &'a mut String,
    pub is_group: bool,

    pub info: &'a mut String,
    pub is_info: bool,

    pub str_num: u32,
}

pub struct AzContext<'a> {
    uri: &'a str,
    user_uri: &'a str,
    request_access: u8,
    calc_right_res: u8,
    is_need_exclusive_az: bool,
    is_found_exclusive_az: bool,
    walked_groups_s: &'a mut HashMap<String, (u8, char)>,
    tree_groups_s: &'a mut HashMap<String, String>,
    walked_groups_o: &'a mut HashMap<String, u8>,
    tree_groups_o: &'a mut HashMap<String, String>,
    subject_groups: &'a mut HashMap<String, Right>,
    checked_groups: &'a mut HashMap<String, u8>,
}

pub fn get_elements_from_index(src: &str, results: &mut Vec<Right>) -> bool {
    if src.is_empty() {
        return false;
    }

    let tokens: Vec<&str> = src.split(';').collect();

    let mut idx = 0;
    loop {
        if idx + 1 < tokens.len() {
            let key = tokens[idx];
            let mut access = 0;
            let mut shift = 0;
            let mut marker = 0 as char;

            for c in tokens[idx + 1].chars() {
                if c == M_IS_EXCLUSIVE || c == M_IGNORE_EXCLUSIVE {
                    marker = c;
                } else {
                    match c.to_digit(16) {
                        Some(v) => access |= v << shift,
                        None => {
                            eprintln!("ERR! rights_from_string, fail parse, access is not hex digit {}", src);
                            continue;
                        }
                    }
                    shift += 4;
                }
            }

            let rr = Right {
                id: key.to_string(),
                access: access as u8,
                marker,
                is_deleted: false,
                level: 0,
            };
            results.push(rr);
        } else {
            break;
        }

        idx += 2;
        if idx >= tokens.len() {
            break;
        }
    }

    true
}

fn authorize_obj_group(
    azc: &mut AzContext,
    trace: &mut Trace,
    request_access: u8,
    object_group_id: &str,
    object_group_access: u8,
    filter_value: &str,
    db: &dyn Storage,
) -> Result<bool, i64> {
    let mut is_authorized = false;
    let mut calc_bits;

    if !trace.is_info && !trace.is_group && !trace.is_acl {
        let left_to_check = (azc.calc_right_res ^ request_access) & request_access;

        if left_to_check & object_group_access == 0 {
            return Ok(is_authorized);
        }

        if let Some(v) = azc.checked_groups.get(object_group_id) {
            if *v == object_group_access {
                return Ok(is_authorized);
            }
        }

        azc.checked_groups.insert(object_group_id.to_string(), object_group_access);
    }

    db.fiber_yield();

    if trace.is_group {
        print_to_trace_group(trace, format!("{}\n", object_group_id));
    }

    let acl_key = if !filter_value.is_empty() {
        PERMISSION_PREFIX.to_owned() + filter_value + object_group_id
    } else {
        PERMISSION_PREFIX.to_owned() + object_group_id
    };

    //        if trace.is_info {
    //            print_to_trace_info(trace, format!("look acl_key: [{}]\n",
    // acl_key));        }

    match db.get(&acl_key) {
        Ok(str) => {
            let permissions: &mut Vec<Right> = &mut Vec::new();

            get_elements_from_index(&str, permissions);

            for permission in permissions {
                /*
                                                if trace.is_info {
                                                    let req_acs = request_access;
                                                    print_to_trace_info(
                                                        trace,
                                                        format!(
                                                            "restriction={} {}, permission={:?}, request={}\n",
                                                            object_group_id,
                                                            access_to_pretty_string(object_group_access),
                                                            permission,
                                                            access_to_pretty_string(req_acs)
                                                        ),
                                                    );
                                                }
                */

                let subj_id = &permission.id;
                if azc.subject_groups.contains_key(subj_id) {
                    let restriction_access = object_group_access;

                    let permission_access = if permission.access > 15 {
                        (((permission.access & 0xF0) >> 4) ^ 0x0F) & permission.access
                    } else {
                        permission.access
                    };

                    for i_access in ACCESS_LIST.iter() {
                        let access = *i_access;
                        if (request_access & access & restriction_access) != 0 {
                            calc_bits = access & permission_access;

                            if calc_bits > 0 {
                                let prev_res = azc.calc_right_res;

                                azc.calc_right_res |= calc_bits;

                                if (azc.calc_right_res & request_access) == request_access {
                                    if trace.is_info {
                                    } else if !trace.is_group && !trace.is_acl {
                                        is_authorized = true;
                                        return Ok(is_authorized);
                                    }
                                }

                                if trace.is_info && prev_res != azc.calc_right_res {
                                    let f_log_str = if !filter_value.is_empty() {
                                        ", with filter ".to_owned() + filter_value
                                    } else {
                                        "".to_owned()
                                    };

                                    print_to_trace_info(
                                        trace,
                                        format!(
                                            "found permission S:[{}], O:[{}], access={} {}\n",
                                            &subj_id,
                                            &object_group_id,
                                            access_to_pretty_string(permission_access),
                                            f_log_str
                                        ),
                                    );

                                    print_to_trace_info(
                                        trace,
                                        format!(
                                            "access: request={}, calc={}, total={}\n",
                                            access_to_pretty_string(request_access),
                                            access_to_pretty_string(calc_bits),
                                            access_to_pretty_string(azc.calc_right_res)
                                        ),
                                    );
                                    print_to_trace_info(trace, "O-PATH".to_owned() + &get_path(azc.tree_groups_o, object_group_id.to_string()) + "\n");
                                    print_to_trace_info(trace, "S-PATH".to_owned() + &get_path(azc.tree_groups_s, subj_id.to_string()) + "\n");
                                }

                                if trace.is_acl {
                                    print_to_trace_acl(trace, format!("{};{};{}\n", object_group_id, subj_id, ACCESS_LIST_PREDICATES[*i_access as usize]));
                                }
                            }
                        }
                    }
                }
            }
        }
        Err(e) => {
            if e < 0 {
                eprintln!("ERR! Authorize: authorize_obj_group:main, object_group_id={:?}", object_group_id);
                return Err(e);
            }
        }
    }

    /*    if trace.is_info {
        match db.get(&acl_key, &db) {
            Ok(str) => {
                let permissions: &mut Vec<Right> = &mut Vec::new();
                get_elements_from_index(&str, permissions);
                print_to_trace_info(trace, format!("for [{}] found {:?}\n", acl_key, permissions));
            },
            Err(e) => if e < 0 {
                eprintln!("ERR! Authorize: authorize_obj_group:trace, object_group_id={:?}", object_group_id);
                return Err(e);
            },
        }
    }*/

    if (azc.calc_right_res & request_access) == request_access {
        if trace.is_info {
            /*            let req_acs = request_access;
                        let crr_acs = azc.calc_right_res;
                        print_to_trace_info(
                            trace,
                            format!("EXIT? request_access={}, res={}\n", access_to_pretty_string(req_acs), access_to_pretty_string(crr_acs)),
                        );
            */

        }

        if !trace.is_info && !trace.is_group && !trace.is_acl {
            is_authorized = true;
            return Ok(is_authorized);
        }
    }

    Ok(false)
}

fn prepare_obj_group(
    azc: &mut AzContext,
    trace: &mut Trace,
    request_access: u8,
    uri: &str,
    access: u8,
    filter_value: &str,
    level: u8,
    db: &dyn Storage,
) -> Result<bool, i64> {
    if level > 32 {
        //        if trace.is_info {
        //            print_to_trace_info(trace, format!("ERR! level down > 32,
        // uri={}\n", uri));        }

        return Ok(false);
    }

    db.fiber_yield();

    let mut is_contain_suffix_group = false;
    let groups_set_len;

    match db.get(&(MEMBERSHIP_PREFIX.to_owned() + uri)) {
        Ok(groups_str) => {
            let groups_set: &mut Vec<Right> = &mut Vec::new();
            get_elements_from_index(&groups_str, groups_set);

            groups_set_len = groups_set.len();

            for (idx, group) in groups_set.iter_mut().enumerate().take(groups_set_len) {
                if group.id.is_empty() {
                    eprintln!("WARN! skip, group is null, uri={}, group.id={}", uri, group.id);
                    continue;
                }

                let new_access = group.access & access;
                group.access = new_access;

                let key = group.id.clone();

                if azc.is_need_exclusive_az && !azc.is_found_exclusive_az {
                    if level == 0 {
                        if group.id.contains("_group") {
                            is_contain_suffix_group = true;
                        }

                        if idx == groups_set_len - 1 && !is_contain_suffix_group {
                            azc.is_found_exclusive_az = true;
                        }

                        if group.id.contains("cfg:TTLResourcesGroup") {
                            azc.is_found_exclusive_az = true;
                        }
                    }

                    if !azc.is_found_exclusive_az && (level == 0 || uri.contains("_group")) && azc.subject_groups.contains_key(&key) {
                        if let Some(s_val) = azc.subject_groups.get(&key) {
                            if s_val.marker == M_IS_EXCLUSIVE {
                                azc.is_found_exclusive_az = true;
                            }
                        }
                    }
                }

                if group.marker == M_IS_EXCLUSIVE {
                    continue;
                }

                let mut preur_access = 0;

                if azc.walked_groups_o.contains_key(&key) {
                    preur_access = azc.walked_groups_o[&key];
                    if (preur_access & new_access) == new_access {
                        continue;
                    }
                }

                if trace.is_info {
                    azc.walked_groups_o.insert(key.clone(), new_access | preur_access);
                    azc.tree_groups_o.insert(key.clone(), uri.to_string());
                } else {
                    azc.walked_groups_o.insert(key.clone(), new_access | preur_access);
                }

                if uri == group.id {
                    continue;
                }

                //if trace.is_info {
                //	print_to_trace_info(trace, format!("({})prepare group: [{}]\n", level,
                // uri));
                //}

                match authorize_obj_group(azc, trace, request_access, &group.id, group.access, filter_value, db) {
                    Ok(res) => {
                        if res {
                            if !azc.is_need_exclusive_az {
                                return Ok(true);
                            }

                            if azc.is_need_exclusive_az && azc.is_found_exclusive_az {
                                return Ok(true);
                            }
                        }
                    }
                    Err(e) => {
                        if e < 0 {
                            return Err(e);
                        }
                    }
                }

                prepare_obj_group(azc, trace, request_access, &group.id, new_access, filter_value, level + 1, db)?;
            }

            if groups_set_len == 0 {
                azc.is_found_exclusive_az = true;
            }

            Ok(false)
        }
        Err(e) => {
            if e < 0 {
                eprintln!("ERR! Authorize: prepare_obj_group {:?}", uri);
                Err(e)
            } else {
                if level == 0 {
                    azc.is_found_exclusive_az = true;
                }
                Ok(false)
            }
        }
    }
}

fn get_resource_groups(
    walked_groups: &mut HashMap<String, (u8, char)>,
    tree_groups: &mut HashMap<String, String>,
    trace: &mut Trace,
    uri: &str,
    access: u8,
    results: &mut HashMap<String, Right>,
    filter_value: &str,
    level: u8,
    db: &dyn Storage,
    out_f_is_exclusive: &mut bool,
    ignore_exclusive: bool,
) -> Result<bool, i64> {
    if level > 32 {
        //        if trace.is_info {
        //            print_to_trace_info(trace, format!("ERR! level down > 32,
        // uri={}\n", uri));        }
        return Ok(true);
    }

    match db.get(&(MEMBERSHIP_PREFIX.to_owned() + uri)) {
        Ok(groups_str) => {
            let groups_set: &mut Vec<Right> = &mut Vec::new();
            get_elements_from_index(&groups_str, groups_set);

            for (idx, group) in groups_set.iter_mut().enumerate() {
                if group.id.is_empty() {
                    eprintln!("WARN! WARN! group is null, uri={}, idx={}", uri, idx);
                    continue;
                }

                let new_access = group.access & access;
                group.access = new_access;

                let mut preur_access = 0;
                if walked_groups.contains_key(&group.id) {
                    preur_access = walked_groups[&group.id].0;
                    if (preur_access & new_access) == new_access && group.marker == walked_groups[&group.id].1 {
                        /*                           if trace.is_info {
                                                        print_to_trace_info(
                                                            trace,
                                                            format!(
                                                                "{:1$} ({})GROUP [{}].access={} SKIP, ALREADY ADDED\n",
                                                                level * 2,
                                                                level as usize,
                                                                group.id,
                                                                access_to_pretty_string(preur_access)
                                                            ),
                                                        );
                                                    }
                        */

                        continue;
                    }
                }

                walked_groups.insert(group.id.clone(), ((new_access | preur_access), group.marker));

                if trace.is_info {
                    tree_groups.insert(group.id.clone(), uri.to_string());
                }

                /*
                                if trace.is_info {
                                    print_to_trace_info(
                                        trace,
                                        format!(
                                            "{:1$} ({})GROUP [{}] {}-> {}\n",
                                            level * 2,
                                            level as usize,
                                            group.id,
                                            access_to_pretty_string(orig_access),
                                            access_to_pretty_string(new_access)
                                        ),
                                    );
                                }
                */
                if uri == group.id {
                    /*                    if trace.is_info {
                        print_to_trace_info(
                            trace,
                            format!(
                                "{:1$} ({})GROUP [{}].access={} SKIP, uri == group_key\n",
                                level * 2,
                                level as usize,
                                group.id,
                                access_to_pretty_string(orig_access)
                            ),
                        );
                    } */
                    continue;
                }

                let t_ignore_exclusive = if !ignore_exclusive && group.marker == M_IGNORE_EXCLUSIVE {
                    true
                } else {
                    ignore_exclusive
                };

                db.fiber_yield();

                match get_resource_groups(walked_groups, tree_groups, trace, &group.id, 15, results, filter_value, level + 1, db, out_f_is_exclusive, t_ignore_exclusive)
                {
                    Ok(_res) => {}
                    Err(e) => {
                        if e < 0 {
                            return Err(e);
                        }
                    }
                }

                if !ignore_exclusive && group.marker == M_IS_EXCLUSIVE {
                    if trace.is_info {
                        print_to_trace_info(trace, format!("FOUND EXCLUSIVE RESTRICTIONS, PATH={} \n", &get_path(tree_groups, group.id.clone())));
                    }
                    *out_f_is_exclusive = true;
                }

                let new_group_marker;

                match results.get(&group.id) {
                    Some(val) => {
                        if val.marker == 0 as char {
                            new_group_marker = group.marker;
                        } else {
                            new_group_marker = val.marker;
                        }
                    }
                    None => {
                        new_group_marker = group.marker;
                    }
                }

                results.insert(
                    group.id.clone(),
                    Right {
                        id: group.id.clone(),
                        access: group.access,
                        marker: new_group_marker,
                        is_deleted: group.is_deleted,
                        level,
                    },
                );
            }
        }
        Err(e) => {
            if e < 0 {
                eprintln!("ERR! Authorize: get_resource_groups {:?}", uri);
                return Err(e);
            } else {
                return Ok(false);
            }
        }
    }

    Ok(false)
}

fn print_to_trace_acl(trace: &mut Trace, text: String) {
    trace.acl.push_str(&text);
}

fn print_to_trace_group(trace: &mut Trace, text: String) {
    trace.group.push_str(&text);
}

pub fn print_to_trace_info(trace: &mut Trace, text: String) {
    trace.str_num += 1;
    trace.info.push_str(&(trace.str_num.to_string() + " " + &text));
}

fn get_path(mopc: &mut HashMap<String, String>, el: String) -> String {
    if mopc.contains_key(&el) {
        let parent = mopc[&el].clone();
        mopc.remove(&el);
        let prev = get_path(mopc, parent);

        prev + "->" + &el
    } else {
        "".to_owned()
    }
}

pub fn access_to_pretty_string(src: u8) -> String {
    let mut res: String = "".to_owned();

    if src & 1 == 1 {
        res.push_str("C ");
    }

    if src & 2 == 2 {
        res.push_str("R ");
    }

    if src & 4 == 4 {
        res.push_str("U ");
    }

    if src & 8 == 8 {
        res.push_str("D ");
    }

    if src & 16 == 16 {
        res.push_str("!C ");
    }

    if src & 32 == 32 {
        res.push_str("!R ");
    }

    if src & 64 == 64 {
        res.push_str("!U ");
    }

    if src & 128 == 128 {
        res.push_str("!D ");
    }

    res
}

fn final_check(azc: &mut AzContext, trace: &mut Trace) -> bool {
    let res = if azc.is_need_exclusive_az && azc.is_found_exclusive_az {
        true
    } else {
        !azc.is_need_exclusive_az
    };

    if trace.is_info && res {
        print_to_trace_info(
            trace,
            format!(
                "result: uri={}, user={}, request={}, answer={}\n\n",
                azc.uri,
                azc.user_uri,
                access_to_pretty_string(azc.request_access),
                access_to_pretty_string(azc.calc_right_res)
            ),
        );
    }

    res
}

pub fn authorize(
    uri: &str,
    user_uri: &str,
    request_access: u8,
    filter_value: &str,
    filter_allow_access_to_other: u8,
    db: &dyn Storage,
    trace: &mut Trace,
) -> Result<u8, i64> {
    let s_groups = &mut HashMap::new();

    let mut azc = AzContext {
        uri,
        user_uri,
        request_access,
        calc_right_res: 0,
        is_need_exclusive_az: false,
        is_found_exclusive_az: false,
        walked_groups_s: &mut HashMap::new(),
        tree_groups_s: &mut HashMap::new(),
        walked_groups_o: &mut HashMap::new(),
        tree_groups_o: &mut HashMap::new(),
        subject_groups: &mut HashMap::new(),
        checked_groups: &mut HashMap::new(),
    };

    // читаем группы subject (ticket.user_uri)
    if trace.is_info {
        print_to_trace_info(trace, format!("authorize uri={}, user={}, request_access={}\n", uri, user_uri, access_to_pretty_string(request_access)));
    }

    //   if trace.is_info {
    //       print_to_trace_info(trace, "READ SUBJECT GROUPS\n".to_string());
    //   }

    match get_resource_groups(azc.walked_groups_s, azc.tree_groups_s, trace, user_uri, 15, s_groups, &filter_value, 0, db, &mut azc.is_need_exclusive_az, false) {
        Ok(_res) => {}
        Err(e) => return Err(e),
    }
    db.fiber_yield();

    azc.subject_groups = s_groups;

    azc.subject_groups.insert(
        user_uri.to_string(),
        Right {
            id: user_uri.to_string(),
            access: 15,
            marker: 0 as char,
            is_deleted: false,
            level: 0,
        },
    );

    //    if trace.is_info {
    //        let str = format!("subject_groups={:?}\n", azc.subject_groups);
    //        print_to_trace_info(trace, str);
    //    }

    let mut request_access_t = request_access;
    let empty_filter_value = String::new();

    if !filter_value.is_empty() {
        request_access_t = request_access & filter_allow_access_to_other;
    }

    if !trace.is_info && !trace.is_group && !trace.is_acl {
        match authorize_obj_group(&mut azc, trace, request_access_t, "v-s:AllResourcesGroup", 15, &empty_filter_value, db) {
            Ok(res) => {
                if res {
                    if filter_value.is_empty() || (!filter_value.is_empty() && request_access == azc.calc_right_res) {
                        if final_check(&mut azc, trace) {
                            return Ok(azc.calc_right_res);
                        }
                    }
                }
            }
            Err(e) => return Err(e),
        }

        match authorize_obj_group(&mut azc, trace, request_access_t, uri, 15, &empty_filter_value, db) {
            Ok(res) => {
                if res {
                    if filter_value.is_empty() || (!filter_value.is_empty() && request_access == azc.calc_right_res) {
                        if final_check(&mut azc, trace) {
                            return Ok(azc.calc_right_res);
                        }
                    }
                }
            }
            Err(e) => return Err(e),
        }

        match prepare_obj_group(&mut azc, trace, request_access_t, uri, 15, &empty_filter_value, 0, db) {
            Ok(res) => {
                if res {
                    if filter_value.is_empty() || (!filter_value.is_empty() && request_access == azc.calc_right_res) {
                        if final_check(&mut azc, trace) {
                            return Ok(azc.calc_right_res);
                        }
                    }
                }
            }
            Err(e) => return Err(e),
        }

        if !filter_value.is_empty() {
            azc.checked_groups.clear();
            azc.walked_groups_o.clear();

            match authorize_obj_group(&mut azc, trace, request_access, "v-s:AllResourcesGroup", 15, &filter_value, db) {
                Ok(res) => {
                    if res && final_check(&mut azc, trace) {
                        return Ok(azc.calc_right_res);
                    }
                }
                Err(e) => return Err(e),
            }

            match authorize_obj_group(&mut azc, trace, request_access, uri, 15, &filter_value, db) {
                Ok(res) => {
                    if res && final_check(&mut azc, trace) {
                        return Ok(azc.calc_right_res);
                    }
                }
                Err(e) => return Err(e),
            }

            match prepare_obj_group(&mut azc, trace, request_access, uri, 15, &filter_value, 0, db) {
                Ok(res) => {
                    if res && final_check(&mut azc, trace) {
                        return Ok(azc.calc_right_res);
                    }
                }
                Err(e) => return Err(e),
            }
        }
    } else {
        // IF NEED TRACE

        match authorize_obj_group(&mut azc, trace, request_access_t, "v-s:AllResourcesGroup", 15, &empty_filter_value, db) {
            Ok(res) => {
                if res {
                    if filter_value.is_empty() || (!filter_value.is_empty() && request_access == azc.calc_right_res) {
                        //                    if trace.is_info {
                        //                        print_to_trace_info(trace, format!("RETURN MY BE
                        // ASAP\n"));                    }
                    } else if final_check(&mut azc, trace) {
                        return Ok(azc.calc_right_res);
                    }
                }
            }
            Err(e) => return Err(e),
        }

        match authorize_obj_group(&mut azc, trace, request_access_t, uri, 15, &empty_filter_value, db) {
            Ok(res) => {
                if res {
                    if filter_value.is_empty() || (!filter_value.is_empty() && request_access == azc.calc_right_res) {
                        //                    if trace.is_info {
                        //                        print_to_trace_info(trace, format!("RETURN MY BE
                        // ASAP\n"));                    }
                    } else if final_check(&mut azc, trace) {
                        return Ok(azc.calc_right_res);
                    }
                }
            }
            Err(e) => return Err(e),
        }

        match prepare_obj_group(&mut azc, trace, request_access_t, uri, 15, &empty_filter_value, 0, db) {
            Ok(res) => {
                if res {
                    if filter_value.is_empty() || (!filter_value.is_empty() && request_access == azc.calc_right_res) {
                        //                    if trace.is_info {
                        //                        print_to_trace_info(trace, format!("RETURN MY BE
                        // ASAP\n"));                    }
                    }
                } else if final_check(&mut azc, trace) {
                    return Ok(azc.calc_right_res);
                }
            }
            Err(e) => return Err(e),
        }

        if !filter_value.is_empty() {
            if trace.is_info {
                print_to_trace_info(trace, format!("USE FILTER: [{}]\n", filter_value));
            }

            azc.checked_groups.clear();
            azc.walked_groups_o.clear();

            match authorize_obj_group(&mut azc, trace, request_access, "v-s:AllResourcesGroup", 15, &filter_value, db) {
                Ok(res) => {
                    if res {
                        //                    if trace.is_info {
                        //                        print_to_trace_info(trace, format!("RETURN MY BE
                        // ASAP\n"));                    }
                    } else if final_check(&mut azc, trace) {
                        return Ok(azc.calc_right_res);
                    }
                }
                Err(e) => return Err(e),
            }

            match authorize_obj_group(&mut azc, trace, request_access, uri, 15, &filter_value, db) {
                Ok(res) => {
                    if res {
                        //                    if trace.is_info {
                        //                        print_to_trace_info(trace, format!("RETURN MY BE
                        // ASAP\n"));                    }
                    } else if final_check(&mut azc, trace) {
                        return Ok(azc.calc_right_res);
                    }
                }
                Err(e) => return Err(e),
            }

            match prepare_obj_group(&mut azc, trace, request_access, uri, 15, &filter_value, 0, db) {
                Ok(res) => {
                    if res {
                        //                    if trace.is_info {
                        //                        print_to_trace_info(trace, format!("RETURN MY BE
                        // ASAP\n"));                    }
                    } else if final_check(&mut azc, trace) {
                        return Ok(azc.calc_right_res);
                    }
                }
                Err(e) => return Err(e),
            }
        }
    }

    if final_check(&mut azc, trace) {
        Ok(azc.calc_right_res)
    } else {
        if trace.is_acl {
            trace.acl.clear();
        }

        if trace.is_info {
            print_to_trace_info(
                trace,
                format!(
                    "result: uri={}, user={}, request={}, answer={}\n\n",
                    azc.uri,
                    azc.user_uri,
                    access_to_pretty_string(azc.request_access),
                    access_to_pretty_string(0)
                ),
            );
        }

        Ok(0)
    }
}
