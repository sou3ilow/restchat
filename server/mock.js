
const port = 8888;
const cors_allow_origin = '*'
const cors_allow_method = 'POST'

const express = require("express");
require('console-info');
require('console-warn');
require('console-error');

const app = express();
app.use(express.json());

const base_path = "/v1"

function DB() {
	this.db = [];
}

DB.prototype.length = function(m){
}

DB.prototype.push = function(m){
	this.db.push(m);
}

DB.prototype.query = function(timestamp, except) {
	let ret = [];

	timestamp = timestamp || new Date(0);

	function filter(elem) {
		return timestamp < elem.timestamp && except != elem.sign;
	}

	return this.db.filter(filter);
}


let db = new DB();

app.use((req, res, next) => {
    res.append('Access-Control-Allow-Origin', cors_allow_origin);
    res.append('Access-Control-Allow-Methods', cors_allow_method);
    res.append('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

app.post(base_path + "/query", function(req, res) {
	console.info("query is called");
	let body = req.body;

	let resbody = db.query(body.timestamp, body.except);
	console.info(resbody.length + "results");
	res.type('application/json').send(resbody);
});

app.post(base_path + '/post', function(req, res) {
	console.info("post is called");
	let body = req.body;

	if ( !body ) {
		res.status(400).send('Bad Request');
		return;
	}

	if ( body.timestamp ) {
		console.warn("timestamp is ignored");
	}

	let m = {
		type : body.type || 'text',
		message : body.message || "",
		timestamp : Date.now(),
		sign : body.sign || "",
	}
	db.push(m);
	console.info("new message" + JSON.stringify(m));
	console.info("total " + db.length);
	res.status(200).send("");
});

app.listen(port, function() {
	console.info("listen start");
});

