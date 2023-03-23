import { APIGatewayProxyHandler } from "aws-lambda";
import { v4 as uuidv4 } from "uuid";
import { dynamoDB } from "../dynamoDB";

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

async function getServicePoints() {
  const result = await dynamoDB
    .scan({ TableName: process.env.SERVICE_POINTS_TABLE })
    .promise();
  return {
    statusCode: 200,
    body: JSON.stringify(result.Items),
  };
}

async function createServicePoint(event) {
  const { name, description } = JSON.parse(event.body);
  const servicePointId = uuidv4();
  const params = {
    TableName: process.env.SERVICE_POINTS_TABLE,
    Item: {
      id: servicePointId,
      name,
      description,
      status: "active",
    },
  };
  const result = await dynamoDB.put(params).promise();
  return {
    statusCode: 201,
    body: JSON.stringify(result.Attributes),
  };
}

async function updateServicePoint(event) {
  const { id } = event.pathParameters;
  const { name, description, status } = JSON.parse(event.body);
  const params = {
    TableName: process.env.SERVICE_POINTS_TABLE,
    Key: { id },
    UpdateExpression: "set #n = :n, #d = :d, #s = :s",
    ExpressionAttributeNames: {
      "#n": "name",
      "#d": "description",
      "#s": "status",
    },
    ExpressionAttributeValues: { ":n": name, ":d": description, ":s": status },
    ReturnValues: "ALL_NEW",
  };
  const result = await dynamoDB.update(params).promise();
  return {
    statusCode: 200,
    body: JSON.stringify(result.Attributes),
  };
}
