var Promise = require('bluebird');
var config = require('./config');
var redis = require("./lib/RedisClient.js").createClient(config.redis);

function updateRedisWithData(visitorId, data) {
    return new Promise(function(resolve, reject) {
        redis.hmset("visitorId:" + visitorId, 'time', new Date(), 'data', JSON.stringify(data), function(err, reply) {
            resolve(reply);
        });
    })
}

function updateRedisWithVisitorsIds(data) {
    return new Promise(function(resolve, reject) {
        redis.hmset("hashallVisitorIds", 'time', new Date(), 'data',  JSON.stringify(data), function(err, reply) {
            resolve(reply);
        });
    })
}

function updateRedisWithUserData(conversationId, data) {
    return new Promise(function(resolve, reject) {
        redis.hmset("conversationId:" + conversationId, 'time', new Date(), 'data', JSON.stringify(data), function(err, reply) {
            resolve(reply);
        });
    })
}

function updateRedisconnectedAgent(convid, data) {
    return new Promise(function(resolve, reject) {
        redis.hmset("convid:" + convid, 'time', new Date(), "data", data, function(err, reply) {
            resolve(reply);
        });
    })
}

function insertLPToken(convid, token) {
    return new Promise(function(resolve, reject) {
        redis.hmset("token:" + convid, 'time', new Date(), "data", token, function(err, reply) {
            resolve(reply);
        });
    })
}

function setTtl(visitorOrGroupId, hashType) {
    redis.expire(hashType + ':' + visitorOrGroupId, 28800);
    console.log("TTL set successfully");
}

function getRedisData(key) {
    return new Promise(
        function(resolve, reject) {
            redis.hgetall(key, function(err, object) {
                if (err)
                    reject(err);
                else
                if (object) {
                    var resp;
                    try {
                        resp = JSON.parse(object.data)
                    } catch (e) {
                        resp = object.data;
                    }
                    resolve(resp)
                } else
                    resolve(undefined);
            });
        });
}

function getRedisDataId(key) {
    return new Promise(
        function(resolve, reject) {
            redis.hgetall(key, function(err, object) {
                if (err)
                    reject(err);
                else
                if (object) {
                    resolve(object);
                } else
                    resolve(undefined);
            });
        });
}

function getRedisTTL(key) {
    return new Promise(
        function(resolve, reject) {
            redis.ttl(key, function(err, object) {
                if (err) {
                    reject(err);
                } else
                if (object) {
                    resolve(object);
                } else {
                    resolve(undefined);
                }
            });
        });
}

function updateRedisById(key) {
    return new Promise(function(resolve, reject) {
        redis.expire(key, 28800, function(err, data) {
            resolve(data);
        });
    });
}

function deleteRedisData(key) {
    redis.del(key, function(err, reply) {
        console.log('deleted data --------', reply);
    });
}

function insertAppJWTToken(key) {
    redis.set("appJWTToken", key);
    redis.expire("appJWTToken", 3300);
}

function getAppJWTToken(key) {
    return new Promise(function(resolve, reject) {
        redis.get(key, function(err, reply) {
            if (err) {
                reject(err);
            } else {
                if (reply) {
                    resolve(reply);
                } else {
                    resolve(undefined);
                }
            }
        });
    })
}
module.exports.updateRedisWithData = updateRedisWithData;
/*module.exports.updateRedisWithEntry = updateRedisWithEntry;*/
module.exports.updateRedisWithUserData = updateRedisWithUserData;
module.exports.updateRedisconnectedAgent = updateRedisconnectedAgent;
module.exports.getRedisData = getRedisData;
module.exports.deleteRedisData = deleteRedisData;
module.exports.setTtl = setTtl;
module.exports.getRedisDataId = getRedisDataId;
module.exports.getRedisTTL = getRedisTTL;
module.exports.updateRedisById = updateRedisById;
module.exports.insertLPToken = insertLPToken;
module.exports.insertAppJWTToken = insertAppJWTToken;
module.exports.getAppJWTToken = getAppJWTToken;
module.exports.updateRedisWithVisitorsIds =updateRedisWithVisitorsIds;
