import { APIGatewayProxyHandler } from "aws-lambda";
import { v4 as uuidv4 } from "uuid";
import { dynamoDB } from "../dynamoDB";
const MAX_NUMBER_OF_SYMBOL_CLIENT_NUMBER = 3;
const MAX_NUMBER_CLIENT = 999;

export const getQueueHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  try {
    return await getQueue();
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: "Internal Server Error",
    };
  }
};

export const addNewClientToQueueHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  try {
    const { serviceId } = event.pathParameters;
    return await addNewClientToQueue(serviceId);
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: "Internal Server Error",
    };
  }
};

export const updateClientHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  try {
    const { clientId } = event.pathParameters;
    const { status } = JSON.parse(event.body);
    return await updateClient(clientId, status);
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: "Internal Server Error",
    };
  }
};

export const getQueuePositionHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  try {
    const { clientNumber } = event.pathParameters;
    const queuePositionResponse = await getQueuePosition(clientNumber);
    return {
      statusCode: 200,
      body: JSON.stringify(queuePositionResponse),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
    };
  }
};

async function getQueue() {
  const result = await dynamoDB
    .scan({ TableName: process.env.CLIENTS_TABLE })
    .promise();
  return {
    statusCode: 200,
    body: JSON.stringify(result.Items),
  };
}

async function addNewClientToQueue(serviceId) {
  const clientId = uuidv4();
  const nextCounter = await getNextCounter();
  const params = {
    TransactItems: [
      {
        Put: {
          TableName: process.env.CLIENTS_TABLE,
          Item: {
            id: clientId,
            service_id: serviceId,
            status: "queued",
            created_at: new Date().toISOString(),
            client_number: nextCounter
              .toString()
              .padStart(MAX_NUMBER_OF_SYMBOL_CLIENT_NUMBER, "0"),
          },
        },
      },
    ],
  };
  await dynamoDB.transactWrite(params).promise();
  const { queuePosition } = await getQueuePosition(nextCounter.toString());
  const response = {
    client_id: clientId,
    queue_number: queuePosition,
    client_number: nextCounter,
  };
  return {
    statusCode: 201,
    body: JSON.stringify(response),
  };
}

async function updateClient(clientId: string, status: "served" | "cancelled") {
  const params = {
    TableName: process.env.CLIENTS_TABLE,
    Key: { clientId },
    UpdateExpression: "set #s = :s",
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: { ":s": status },
    ReturnValues: "ALL_NEW",
  };
  const result = await dynamoDB.update(params).promise();
  return {
    statusCode: 200,
    body: JSON.stringify(result.Attributes),
  };
}

async function getNextCounter(): Promise<string> {
  let counter: number;
  {
    const params = {
      TableName: process.env.COUNTERS_TABLE,
      // todo: use a better type key
      Key: { id: "48059f4f-f575-420b-97eb-5003b0816d30" },
      UpdateExpression: "ADD  current_value :incr",
      ExpressionAttributeValues: { ":incr": 1 },
      ReturnValues: "UPDATED_NEW",
    };
    const result = await dynamoDB.update(params).promise();
    counter = result.Attributes.current_value;
  }
  if (counter > MAX_NUMBER_CLIENT) {
    const params = {
      TableName: process.env.COUNTERS_TABLE,
      // todo: use a better type key
      Key: { id: "48059f4f-f575-420b-97eb-5003b0816d30" },
      UpdateExpression: "set  current_value = :cv",
      ExpressionAttributeValues: { ":cv": 1 },
      ReturnValues: "UPDATED_NEW",
    };
    const result = await dynamoDB.update(params).promise();
    counter = result.Attributes.current_value;
  }

  return counter.toString().padStart(MAX_NUMBER_OF_SYMBOL_CLIENT_NUMBER, "0");
}

async function getQueuePosition(clientNumber: string): Promise<{
  clientNumber: string;
  queuePosition: string;
}> {
  const result = await dynamoDB
    .scan({
      TableName: process.env.CLIENTS_TABLE,
      FilterExpression: "#s = :s and #c <= :c and #cn < :cn",
      ExpressionAttributeNames: {
        "#s": "status",
        "#c": "created_at",
        "#cn": "client_number",
      },
      ExpressionAttributeValues: {
        ":s": "queued",
        ":c": new Date().toISOString(),
        ":cn": clientNumber,
      },
    })
    .promise();

  return {
    clientNumber,
    queuePosition: result.Count?.toString() || "0",
  };
}
