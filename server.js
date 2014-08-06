// server.js

// BASE SETUP
// =============================================================================

// call the packages we need
var express = require('express'); 		// call express
var app = express(); 				// define our app using express
var bitcoin = require('bitcoin'); //This is the bitcoin RPC library
var async = require('async'); //Yea this helps a bit

//ejs template setup
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

var port = process.env.PORT || 3000; 		// set our port

// ROUTES FOR OUR API
// =============================================================================
var router = express.Router(); 				// get an instance of the express Router

// BITCOIN RPC CLIENT
// =============================================================================
var client = new bitcoin.Client({
    host: 'xxx.xxx.xxx.xxx',
    port: 8332,
    user: 'bitcoinrpc',
    pass: 'password'
});

function getDifficulty(callback) {
     client.getDifficulty( function (err, difficulty) {
        if (err) {
            callback(err.code);      //these should end up handled
        } else
        callback(difficulty);
    });
}

function getProperty(req, callback) {
    var id = 0;
    try {
        id = parseInt(req.params.id);
    } catch (err) {
        id = req.propertyid;
    }
    client.cmd('getproperty_MP', id, function(err, name, resHeaders) {
        if (err) {
            callback(err.code, null); //these should end up handled
        } else
            callback(null, name, req);
    });
}

function getProtocolBalance(req,callback) {
    var address = req.params.address;
    var id = parseInt(req.params.id);
    client.cmd('getbalance_MP', address, id, function (err, balance, resHeaders) {
        if (err) {
            callback(err.code,null);      //these should end up handled
        } else
        callback(null,balance);
    });
}

function getProtocolPropertyList(callback) {
    client.cmd('listproperties_MP', function (err, props, resHeaders) {
        if (err) {
            callback(err.code, null); //these should end up handled
        } else {
            callback(null, props);
        }
    });
}

function getTransactions(callback,req,count) {
    var address = req.params.address;
    client.cmd('listtransactions_MP', address, count, function (err, props, resHeaders) {
        if (err) {
            callback(err.code, null); //these should end up handled
        } else {
            callback(null, props);
        }
    });
}

function getProtocolTransaction(req, callback) {
    var id = req.params.Id;
    client.cmd('gettransaction_MP', id, function (err, tx, resHeaders) {
        if (err) {
            callback(err.code, null); //these should end up handled
        } else {
            callback(null, tx);
        }
    });
}

// REGISTER OUR ROUTES -------------------------------
// all of our routes will be on the root level
app.use('/', router);

// route to the root of our site
router.get('/', function (req, res) {
    res.render('index', null);
});

// Mastercore specific (Actually performs 2 queries )
router.get('/getProtocolBalance/:address/:id', function(req, res) {
    async.series([
            function(callback) {
                getProtocolBalance(req, callback);
            },
            function(callback) {
                getProperty(req, callback);
            },
            function(callback) {
                getTransactions(callback,req,10); //Needs to be wired into the return and the ui
            }
        ],
        function(err, results) {
            res.render("balance", { Id: req.params.id, Address: req.params.address, Balance: results[0], Details: results[1][0] });
        }
    );
});

router.get('/getProtocolProperties',function(req, res) {
    async.series([
        function(callback) {
            getProtocolPropertyList(callback);
        }
    ], function (err, results) {
        var filtered = results[0].filter(isProduction); //I only want production properties so I ignore others
        res.render("properties", { MastercoinProperties: filtered });
    });
});

router.get('/getTransaction/:Id', function (req, res) {
    async.waterfall([
        function(callback) {
            getProtocolTransaction(req, callback);
        }, function(tx, callback) {
            getProperty(tx,callback);
        }
    ], function (err, results, tx) {
        res.render("transaction", { Transaction: tx, Id: req.params.Id, Property: results });
    });
});

router.get('/getProperty/:id', function (req, res) {
    async.series([
        function (callback) {
        getProperty(req, callback);
    }
    ], function (err, results) {
        res.render("property", { Property: results[0][0], Id: req.params.id });
    });
});

// Test route to a bitcoin specific call
router.get('/difficulty', function (req, res) {
    async.series([getDifficulty(function(diff) {
         res.json({ Difficulty: diff });
    })]);
});

// START THE SERVER
// =============================================================================
app.listen(port);
console.log('Magic happens on port ' + port);

//HELPERS
function isProduction(element) {
    return element.propertyid <= 1000;
}
