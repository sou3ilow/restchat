'use strict'

//https://utano.jp/entry/2019/05/aws-serverless-express/
const is_prod = !!process.env.AWS_REGION;
const port = 8888;

// https://zu2febudd4.execute-api.us-west-1.amazonaws.com/prod/

const base_path = is_prod ? "" : "/v1";

const cors_allow_origin = '*'
const cors_allow_method = 'OPTIONS,POST'

if ( !is_prod ) {
	require('console-info');
	require('console-warn');
	require('console-error');
}

/* DB wrap */

process.env.AWS_PROFILE='restchat' 
const compression = require('compression');
const aws = require('aws-sdk');
aws.config.update({region: 'us-west-1'});
const table_name = "messages";
const time_to_live = 5 * 60; // sec

function DB() {
	this.db = new aws.DynamoDB({apiVersion: '2012-08-10'});
}

DB.prototype.push = function(m){
	let params = {
		TableName: table_name,
		Item: m
	};

	this.db.putItem(params, (err, data)=> {
		if (err) {
			console.error("[putitem] error", err);
		} else {
			console.info("[putitem] success", data);
		}
	});
}

// onscan: function([])
DB.prototype.query = function(timestamp, except, onscan) {

	timestamp = timestamp || 0;
	except = except || "";

	let params = {
		TableName: table_name, 
		ProjectionExpression: 'sign, message, #type, #timestamp', // ignore ttl
		FilterExpression: 'sign <> :except AND #timestamp > :newerthan',
		ExpressionAttributeNames: {
			'#type': 'type',
			'#timestamp': 'timestamp'
		},
		ExpressionAttributeValues: {
			':except': {'S': except},
			':newerthan': {'N': String(timestamp) } // hack
		}
	};

	this.db.scan(params, (err, data)=> {
		let results = [];
if (err) {
			console.error("[scan] error", err);
		} else {
			console.log("timestamp =", timestamp);
			console.log("[scan] success", data.Count, data.ScannedCount);
			results = data.Items.map(function(item){
				return {
					type: item.type.S,
					sign: item.sign.S,
					message: item.message.S,
					timestamp: Number(item.timestamp.N)
				}
			});
		}
		onscan(results);
	});
}

let db = new DB();

/* front */
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
//const compression = require('compression')
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')

const router = express.Router()
const app = express();

//router.use(cors())
router.use(bodyParser.json());

if ( is_prod ) {
	console.log("in prod mode");
	router.use(awsServerlessExpressMiddleware.eventContext());
}

app.use((req, res, next) => {
    res.append('Access-Control-Allow-Origin', cors_allow_origin);
    res.append('Access-Control-Allow-Methods', cors_allow_method);
    res.append('Access-Control-Allow-Headers', 'Content-Type');
    res.append('Access-Control-Max-Age', 864000);
    next();
});


exports.handler = function(ev, con) {
	let reponse = {
		satautCode: 200,
		handlers: {
			"Access-Control-Allow-Origin": "*"
		},
		body: JSON.strigify(ev)
	}
	con.succeed(response);
}

router.use(base_path + '/open', compression())

// test
router.get(base_path + '/', (req, res) => {
  res.send("base route");
});
router.get('/', (req, res) => {
  res.send("route");
});

router.get(base_path + '/open', (req, res) => {
	res.sendFile(`${__dirname}/chat.html`)
});

/* quey */
router.post(base_path + "/query", function(req, res) {
	console.info("query is called");
	let body = req.body;

	
	let timestamp = body.from || 0;
	if ( timestamp < 0 ) {
		timestamp = Math.max(Date.now() + timestamp, 0);
	}

	console.log("body =", body.from);
	console.log("timestamp =", timestamp);

	db.query(timestamp, body.except, (results) => {
		console.log(results);
		console.info(results.length + "results");
		res.type('application/json').send(results);
	});
});

/* post */
router.post(base_path + '/post', function(req, res) {
	console.info("post is called");
	let body = req.body;

	if ( !body ) {
		res.status(400).send('Bad Request');
		return;
	}

	if ( body.timestamp ) {
		console.warn("timestamp for post is ignored");
	}

	let timestamp = Date.now();
	let m = {
		sign : {'S': body.sign || ""},
		timestamp : {'N': String(timestamp) }, //HACK
		ttl: {'N': String(Math.floor(timestamp/1000) + time_to_live) },
		type : {'S': body.type || 'text'}, 
		message : {'S': body.message || ""},
	}

	db.push(m);
	console.info("new message" + JSON.stringify(m));
	//console.info("total " + db.length);
	res.status(200).send("");
});

function on_listen() {
	console.info("listen start at port=", port);
	console.info("base path is", base_path);
}

app.use('/', router);

module.exports = app


