import { APIGatewayProxyHandler } from "aws-lambda";
import { v4 as uuidv4 } from "uuid";
import { ddbDocClient } from "../dynamoDB";
import { ScanCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

export const handler: APIGatewayProxyHandler = async (event, context) => {
  try {
    switch (event.httpMethod) {
      case "GET":
        return await getServicePoints();
      case "POST":
        return await createServicePoint(event);
      case "PUT":
        return await updateServicePoint(event);
      default:
        return {
          statusCode: 405,
          body: "Method Not Allowed",
        };
    }
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: "Internal Server Error",
    };
  }
};

const TableName = process.env.SERVICE_POINTS_TABLE;
async function getServicePoints() {
  const result = await ddbDocClient.send(
    new ScanCommand({
      TableName,
    })
  );
  return {
    statusCode: 200,
    body: JSON.stringify(result.Items),
  };
}

async function createServicePoint(event) {
  const { name, description } = JSON.parse(event.body);
  const servicePointId = uuidv4();
  const params = {
    TableName,
    Item: {
      id: servicePointId,
      name,
      description,
      status: "active",
    },
  };
  const result = await ddbDocClient.send(new PutCommand(params));
  return {
    statusCode: 201,
    body: JSON.stringify(result.Attributes),
  };
}

async function updateServicePoint(event) {
  const { id } = event.pathParameters;
  const { name, description, status } = JSON.parse(event.body);
  const params = {
    TableName,
    Key: { id },
    UpdateExpression: "set #n = :n, #d = :d",
    ExpressionAttributeNames: {
      "#n": "name",
      "#d": "description",
    },
    ExpressionAttributeValues: { ":n": name, ":d": description, },
    ReturnValues: "ALL_NEW",
  };
  // const result = await ddbDocClient.update(params).promise();
  const result = await ddbDocClient.send(new UpdateCommand(params));
  return {
    statusCode: 200,
    body: JSON.stringify(result.Attributes),
  };
}

// async function updateServicePoint(event) {
//   const { id } = event.pathParameters;
//   const { name, description, status } = JSON.parse(event.body);
//   const params = {
//     TableName,
//     Key: { id },
//     UpdateExpression: "set #n = :n, #d = :d, #s = :s",
//     ExpressionAttributeNames: {
//       "#n": "name",
//       "#d": "description",
//       "#s": "status",
//     },
//     ExpressionAttributeValues: { ":n": name, ":d": description, ":s": status },
//     ReturnValues: "ALL_NEW",
//   };
//   // const result = await ddbDocClient.update(params).promise();
//   const result = await ddbDocClient.send(new UpdateCommand(params));
//   return {
//     statusCode: 200,
//     body: JSON.stringify(result.Attributes),
//   };
// }
