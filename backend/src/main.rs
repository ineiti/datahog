use std::env;
use std::path::Path;

use rocket::fairing::{Fairing, Info, Kind};
use rocket::fs::{FileServer, NamedFile};
use rocket::http::{ContentType, Header, Method, Status};
use rocket::response::status::BadRequest;
use rocket::serde::json::Json;
use rocket::{Build, Request, Response, Rocket, State};

mod storage;

use storage::{Storage, UpdateReply, UpdateRequest};

#[macro_use]
extern crate rocket;

#[post("/updates", data = "<list>")]
async fn updates(
    storage: &State<Storage>,
    list: Json<UpdateRequest>,
) -> Result<Json<UpdateReply>, BadRequest<String>> {
    Ok(Json(storage.get_updates(list.0).await?))
}

#[options("/updates")]
fn updates_options() -> Status {
    Status::Ok
}

#[get("/reset")]
async fn reset(storage: &State<Storage>) {
    if env::var("ENABLE_RESET").is_ok() {
        storage.reset();
    }
}

#[catch(404)]
async fn catchall() -> Option<NamedFile> {
    println!("catchall");
    NamedFile::open(Path::new(&env::var("STATIC_PAGE").unwrap()).join("index.html"))
        .await
        .ok()
}

#[launch]
async fn rocket() -> Rocket<Build> {
    let rb = rocket::build()
        .attach(CORS)
        .mount("/api/v2", routes![updates, updates_options, reset,])
        .manage(Storage::new());

    if let Ok(web) = env::var("STATIC_PAGE") {
        rb.register("/", catchers![catchall])
            .mount("/", FileServer::from(web.clone()))
    } else {
        rb
    }
}

pub struct CORS;

#[rocket::async_trait]
impl Fairing for CORS {
    fn info(&self) -> Info {
        Info {
            name: "Add CORS headers to responses",
            kind: Kind::Request | Kind::Response,
        }
    }

    async fn on_response<'r>(&self, request: &'r Request<'_>, response: &mut Response<'r>) {
        response.set_header(Header::new("Access-Control-Allow-Origin", "*"));
        response.set_header(Header::new(
            "Access-Control-Allow-Methods",
            "POST, PUT, GET, PATCH, OPTIONS",
        ));
        response.set_header(Header::new("Access-Control-Allow-Headers", "*"));
        response.set_header(Header::new("Access-Control-Allow-Credentials", "true"));
        if request.method() == Method::Options {
            let body = "";
            response.set_header(ContentType::Plain);
            response.set_sized_body(body.len(), std::io::Cursor::new(body));
            response.set_status(Status::Ok);
        }
    }
}

#[cfg(test)]
mod test {}
