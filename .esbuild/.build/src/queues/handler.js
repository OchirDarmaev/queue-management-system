var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/queues/handler.ts
var handler_exports = {};
__export(handler_exports, {
  createQueue: () => createQueue,
  deleteQueue: () => deleteQueue,
  getAllQueues: () => getAllQueues
});
module.exports = __toCommonJS(handler_exports);

// node_modules/uuid/dist/esm-node/rng.js
var import_crypto = __toESM(require("crypto"));
var rnds8Pool = new Uint8Array(256);
var poolPtr = rnds8Pool.length;
function rng() {
  if (poolPtr > rnds8Pool.length - 16) {
    import_crypto.default.randomFillSync(rnds8Pool);
    poolPtr = 0;
  }
  return rnds8Pool.slice(poolPtr, poolPtr += 16);
}

// node_modules/uuid/dist/esm-node/stringify.js
var byteToHex = [];
for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 256).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
  return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}

// node_modules/uuid/dist/esm-node/native.js
var import_crypto2 = __toESM(require("crypto"));
var native_default = {
  randomUUID: import_crypto2.default.randomUUID
};

// node_modules/uuid/dist/esm-node/v4.js
function v4(options2, buf, offset) {
  if (native_default.randomUUID && !buf && !options2) {
    return native_default.randomUUID();
  }
  options2 = options2 || {};
  const rnds = options2.random || (options2.rng || rng)();
  rnds[6] = rnds[6] & 15 | 64;
  rnds[8] = rnds[8] & 63 | 128;
  if (buf) {
    offset = offset || 0;
    for (let i = 0; i < 16; ++i) {
      buf[offset + i] = rnds[i];
    }
    return buf;
  }
  return unsafeStringify(rnds);
}
var v4_default = v4;

// src/queues/handler.ts
var import_aws_sdk = __toESM(require("aws-sdk"));
var options = {};
if (process.env.IS_OFFLINE) {
  options = {
    region: "localhost",
    endpoint: "http://localhost:8000"
  };
}
var dynamoDB = new import_aws_sdk.default.DynamoDB.DocumentClient(options);
var createQueue = async (event) => {
  const { servicePointIds, name } = JSON.parse(event.body);
  const queue = {
    id: v4_default(),
    servicePointIds,
    name
  };
  const params = {
    TableName: process.env.QUEUES_TABLE,
    Item: queue
  };
  await dynamoDB.put(params).promise();
  return {
    statusCode: 201,
    body: JSON.stringify(queue)
  };
};
var deleteQueue = async (event) => {
  const { id } = event.pathParameters;
  const params = {
    TableName: process.env.QUEUES_TABLE,
    Key: { id }
  };
  await dynamoDB.delete(params).promise();
  return {
    statusCode: 204,
    body: ""
  };
};
var getAllQueues = async (event) => {
  console.log("getAllQueues");
  console.log(process.env.QUEUES_TABLE);
  const params = {
    TableName: process.env.QUEUES_TABLE
  };
  const result = await dynamoDB.scan(params).promise();
  return {
    statusCode: 200,
    body: JSON.stringify(result.Items)
  };
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createQueue,
  deleteQueue,
  getAllQueues
});
