import { PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyHandler } from "aws-lambda";
import { ddbDocClient } from "../dynamoDB";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
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
    const serviceId = event.pathParameters.serviceId;
    return await addNewClientToQueue({ serviceId });
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: "Internal Server Error",
    };
  }
};

// export const updateClientHandler: APIGatewayProxyHandler = async (
//   event,
//   context
// ) => {
//   try {
//     const { clientId } = event.pathParameters;
//     const { status } = JSON.parse(event.body);
//     return await updateClient(clientId, status);
//   } catch (error) {
//     console.error(error);
//     return {
//       statusCode: 500,
//       body: "Internal Server Error",
//     };
//   }
// };

// export const getQueuePositionHandler: APIGatewayProxyHandler = async (
//   event,
//   context
// ) => {
//   try {
//     const { clientNumber } = event.pathParameters;
//     const queuePositionResponse = await getQueuePosition(clientNumber);
//     return {
//       statusCode: 200,
//       body: JSON.stringify(queuePositionResponse),
//     };
//   } catch (error) {
//     console.error(error);
//     return {
//       statusCode: 500,
//     };
//   }
// };

async function getQueue() {
  const result = await ddbDocClient.send(
    new ScanCommand({ TableName: process.env.SERVICES_TABLE })
  );
  return {
    statusCode: 200,
    body: JSON.stringify(result.Items),
  };
}

async function addNewClientToQueue({
  serviceId,
}: {
  serviceId: string;
}): Promise<{
  serviceId: string;
  clientNumber: string;
  numberInQueue: number;
}> {
  const params = {
    TableName: process.env.SERVICES_TABLE,
    Key: {
      id: serviceId,
    },

    UpdateExpression: "ADD #cc :incr ",
    ExpressionAttributeNames: { "#cc": "clients_count" },
    ExpressionAttributeValues: { ":incr": 1 },

    // //     user_id: "1", created_at
    // UpdateExpression: "set #u = :u, #c = :c",
    // ExpressionAttributeNames: { "#u": "user_id", "#c": "created_at" },
    // ExpressionAttributeValues: {
    //   ":u": null,
    //   ":c": new Date().toISOString(),
    // },
    ProjectionExpression: "clients_count",
    ReturnValues: "ALL_NEW",
  };
  const result = await ddbDocClient.send(new UpdateCommand(params));
  const clientNumber = result.Attributes.clients_count;

  // return {
  //   serviceId,
  //   clientNumber,
  //   numberInQueue: clientNumber,
  // };

  const params2 = {
    TableName: process.env.CLIENTS_TABLE,
    Item: {
      id: serviceId,
      client_number: clientNumber.toString(),
      created_at: new Date().toISOString(),
      status: "queued",
    },
  };
  await ddbDocClient.send(new PutCommand(params2));
  return {
    serviceId,
    clientNumber,
    // stubbed
    numberInQueue: 0,
  };
}

// async function updateClient(clientId: string, status: "served" | "cancelled") {
//   // const params = {
//   //   TableName: process.env.CLIENTS_TABLE,
//   //   Key: { clientId },
//   //   UpdateExpression: "set #s = :s",
//   //   ExpressionAttributeNames: { "#s": "status" },
//   //   ExpressionAttributeValues: { ":s": status },
//   //   ReturnValues: "ALL_NEW",
//   // };
//   // const result = await dynamoDB.update(params).promise();
//   // return {
//   //   statusCode: 200,
//   //   body: JSON.stringify(result.Attributes),
//   // };
// }

// async function getQueuePosition(clientNumber: string): Promise<{
//   clientNumber: string;
//   queuePosition: string;
// }> {
//   // const result = await dynamoDB
//   //   .scan({
//   //     TableName: process.env.CLIENTS_TABLE,
//   //     FilterExpression: "#s = :s and #c <= :c and #cn < :cn",
//   //     ExpressionAttributeNames: {
//   //       "#s": "status",
//   //       "#c": "created_at",
//   //       "#cn": "client_number",
//   //     },
//   //     ExpressionAttributeValues: {
//   //       ":s": "queued",
//   //       ":c": new Date().toISOString(),
//   //       ":cn": clientNumber,
//   //     },
//   //   })
//   //   .promise();

//   // return {
//   //   clientNumber,
//   //   queuePosition: result.Count?.toString() || "0",
//   // };
// }
