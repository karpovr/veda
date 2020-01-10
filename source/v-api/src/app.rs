#[derive(PartialEq, Debug, Clone)]
#[repr(u16)]
pub enum ResultCode {
    /// 0
    Zero = 0,

    /// 200
    Ok = 200,

    /// 201
    Created = 201,

    /// 204
    NoContent = 204,

    /// 400
    BadRequest = 400,

    /// 403
    Forbidden = 403,

    /// 404
    NotFound = 404,

    /// 422
    UnprocessableEntity = 422,

    /// 429
    TooManyRequests = 429,

    /// 464
    SecretExpired = 464,

    /// 465
    EmptyPassword = 465,

    /// 466
    NewPasswordIsEqualToOld = 466,

    /// 467
    InvalidPassword = 467,

    /// 468
    InvalidSecret = 468,

    /// 469
    PasswordExpired = 469,

    /// 470
    TicketNotFound = 470,

    /// 471
    TicketExpired = 471,

    /// 472
    NotAuthorized = 472,

    /// 473
    AuthenticationFailed = 473,

    /// 474
    NotReady = 474,

    /// 475
    FailOpenTransaction = 475,

    /// 476
    FailCommit = 476,

    /// 477
    FailStore = 477,

    /// 500
    InternalServerError = 500,

    /// 501
    NotImplemented = 501,

    /// 503
    ServiceUnavailable = 503,

    InvalidIdentifier = 904,

    /// 999
    DatabaseModifiedError = 999,

    /// 1021
    DiskFull = 1021,

    /// 1022
    DuplicateKey = 1022,

    /// 1118
    SizeTooLarge = 1118,

    /// 4000
    ConnectError = 4000,
}

impl ResultCode {
    pub fn from_i64(value: i64) -> ResultCode {
        match value {
            0 => ResultCode::Zero,
            200 => ResultCode::Ok,
            201 => ResultCode::Created,
            204 => ResultCode::NoContent,
            400 => ResultCode::BadRequest,
            403 => ResultCode::Forbidden,
            404 => ResultCode::NotFound,
            422 => ResultCode::UnprocessableEntity,
            429 => ResultCode::TooManyRequests,
            464 => ResultCode::SecretExpired,
            465 => ResultCode::EmptyPassword,
            466 => ResultCode::NewPasswordIsEqualToOld,
            467 => ResultCode::InvalidPassword,
            468 => ResultCode::InvalidSecret,
            469 => ResultCode::PasswordExpired,
            470 => ResultCode::TicketNotFound,
            471 => ResultCode::TicketExpired,
            472 => ResultCode::NotAuthorized,
            473 => ResultCode::AuthenticationFailed,
            474 => ResultCode::NotReady,
            475 => ResultCode::FailOpenTransaction,
            476 => ResultCode::FailCommit,
            477 => ResultCode::FailStore,
            500 => ResultCode::InternalServerError,
            501 => ResultCode::NotImplemented,
            503 => ResultCode::ServiceUnavailable,
            904 => ResultCode::InvalidIdentifier,
            999 => ResultCode::DatabaseModifiedError,
            1021 => ResultCode::DiskFull,
            1022 => ResultCode::DuplicateKey,
            1118 => ResultCode::SizeTooLarge,
            4000 => ResultCode::ConnectError,
            // ...
            _ => ResultCode::Zero,
        }
    }
}
