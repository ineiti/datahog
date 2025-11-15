use std::env;
use std::path::Path;
use std::str::FromStr;

use datahog::structs::{Edge, EdgeID, Node, NodeID};
use rocket::fairing::{Fairing, Info, Kind};
use rocket::fs::{FileServer, NamedFile};
use rocket::http::{ContentType, Header, Method, Status};
use rocket::response::status::BadRequest;
use rocket::serde::json::Json;
use rocket::{Build, Request, Response, Rocket, State};

mod storage;

use storage::Storage;

#[macro_use]
extern crate rocket;

#[get("/get_node?<id>")]
async fn get_node(storage: &State<Storage>, id: String) -> Result<Json<Node>, BadRequest<String>> {
    let id = NodeID::from_str(&id).map_err(|e| BadRequest(format!("{e:?}")))?;
    Ok(Json(storage.get_node(id).await?))
}

#[options("/get_node")]
fn get_node_options() -> Status {
    Status::Ok
}

#[post("/get_edge?<id>")]
async fn get_edge(storage: &State<Storage>, id: String) -> Result<Json<Edge>, BadRequest<String>> {
    let id = EdgeID::from_str(&id).map_err(|e| BadRequest(format!("{e:?}")))?;
    Ok(Json(storage.get_edge(id).await?))
}

#[options("/get_edge")]
fn get_edge_options() -> Status {
    Status::Ok
}

#[post("/update_node", data = "<node>")]
async fn update_node(storage: &State<Storage>, node: Json<Node>) -> Result<(), BadRequest<String>> {
    storage.update_node(node.into_inner()).await?;
    Ok(())
}

#[options("/update_node")]
fn update_node_options() -> Status {
    Status::Ok
}

#[post("/update_edge", data = "<edge>")]
async fn update_edge(storage: &State<Storage>, edge: Json<Edge>) -> Result<(), BadRequest<String>> {
    storage.update_edge(edge.into_inner()).await?;
    Ok(())
}

#[options("/update_edge")]
fn update_edge_options() -> Status {
    Status::Ok
}

#[get("/init")]
async fn init(storage: &State<Storage>) -> Result<Json<Node>, BadRequest<String>> {
    Ok(Json(storage.init()))
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
        .mount(
            "/api/v1",
            routes![
                get_edge,
                get_edge_options,
                get_node,
                get_node_options,
                update_edge,
                update_edge_options,
                update_node,
                update_node_options,
                init,
            ],
        )
        .manage(Storage::new().expect("Starting db"));

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
