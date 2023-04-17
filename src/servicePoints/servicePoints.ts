import { APIGatewayProxyHandler, DynamoDBStreamHandler } from "aws-lambda";
import { ddbDocClient } from "../ddb-doc-client";
import {
  BatchGetCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { TableName } from "../table-name";
import { getBoardStatus, getItemsByStatus1 } from "../queue/queue";
import { QueueItem } from "../queue/QueueItem";
import { QueueStatus } from "../queue/QueueStatus";
import { ServiceItem } from "../services/ServiceItem";
import { ServicePointStatus } from "./ServicePointStatus";
import { IServicePoint } from "./IServicePoint";
import { ServicePointItem } from "./ServicePointItem";

export const createServicePointHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  if (!event.body) {
    return {
      statusCode: 400,
      body: "Bad Request",
    };
  }
  try {
    const {
      servicePointId,
      servicePointNumber,
      serviceIds,
      name,
      description,
    } = JSON.parse(event.body);
    const res = await createServicePoint({
      id: servicePointId,
      serviceIds,
      name,
      description,
      servicePointStatus: ServicePointStatus.CLOSED,
      servicePointNumber,
    });
    return {
      statusCode: 201,
      body: JSON.stringify(res),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: "Internal Server Error",
    };
  }
};

export const getServicePointHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  try {
    const id = event.pathParameters?.servicePointId;
    if (!id) {
      return {
        statusCode: 400,
        body: "Bad Request",
      };
    }
    const res = await getServicePoint({ id });
    return {
      statusCode: 200,
      body: JSON.stringify(res),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: "Internal Server Error",
    };
  }
};

export const getServicePointsHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  try {
    const res = await getServicePoints();
    return {
      statusCode: 200,
      body: JSON.stringify(res),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: "Internal Server Error",
    };
  }
};

export const updateServicePointHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  try {
    const servicePointId = event.pathParameters?.servicePointId;
    if (!servicePointId) {
      return {
        statusCode: 400,
        body: "Bad Request",
      };
    }
    if (!event.body) {
      return {
        statusCode: 400,
        body: "Bad Request",
      };
    }
    const { serviceIds, servicePointNumber, name, description, status } =
      JSON.parse(event.body);
    const res = await updateServicePoint({
      id: servicePointId,
      serviceIds,
      name,
      description,
      servicePointNumber,
    });
    return {
      statusCode: 200,
      body: JSON.stringify(res),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: "Internal Server Error",
    };
  }
};

export const removeServicePointHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  try {
    const id = event.pathParameters?.servicePointId;
    if (!id) {
      return {
        statusCode: 400,
        body: "Bad Request",
      };
    }
    const res = await deleteServicePoint({ id });
    return {
      statusCode: 200,
      body: JSON.stringify(res),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: "Internal Server Error",
    };
  }
};

export const updateServicePointStatusHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  try {
    const id = event.pathParameters?.servicePointId;
    if (!id) {
      return {
        statusCode: 400,
        body: "Bad Request",
      };
    }
    const status = event.pathParameters?.status as ServicePointStatus;
    if (!status) {
      return {
        statusCode: 400,
        body: "Bad Request",
      };
    }

    const res = await updateServicePointStatus({
      id,
      servicePointStatus: status,
    });
    return {
      statusCode: 200,
      body: JSON.stringify(res),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: "Internal Server Error",
    };
  }
};

// dynamodb stream handler
export const servicePointStreamHandler: DynamoDBStreamHandler = async (
  event,
  context
) => {
  console.log("event", event);
  const records = event.Records;
  if (!records) {
    return;
  }
  for (const record of records) {
    if (record.eventName === "INSERT") {
      const newImage = record.dynamodb?.NewImage;
      if (!newImage) {
        continue;
      }
      // todo check if it new queue item
    }
  }
};

export async function getServicePoints() {
  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName,
      KeyConditionExpression: "PK = :pk and begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": ServicePointItem.prefixServicePoint,
        ":sk": ServicePointItem.prefixServicePoint,
      },
    })
  );

  return result?.Items?.map((item) => ServicePointItem.fromItem(item)) || [];
}

async function createServicePoint(
  servicePoint: IServicePoint
): Promise<IServicePoint> {
  const servicePointItem = new ServicePointItem(servicePoint);

  await ddbDocClient.send(
    new PutCommand({
      TableName,
      Item: servicePointItem.toItem(),
      ConditionExpression:
        "attribute_not_exists(PK) AND attribute_not_exists(SK)",
    })
  );

  return {
    id: servicePointItem.id,
    serviceIds: servicePointItem.serviceIds,
    name: servicePointItem.name,
    description: servicePointItem.description,
    servicePointStatus: servicePointItem.servicePointStatus,
    servicePointNumber: servicePointItem.servicePointNumber,
  };
}

async function getServicePoint(
  servicePoint: Pick<IServicePoint, "id">
): Promise<IServicePoint> {
  const result = await ddbDocClient.send(
    new GetCommand({
      TableName,
      Key: new ServicePointItem(servicePoint).keys(),
    })
  );
  if (!result.Item) {
    throw new Error("Service point not found");
  }

  return new ServicePointItem(result.Item);
}

async function updateServicePoint(
  servicePoint: Omit<IServicePoint, "servicePointStatus">
): Promise<IServicePoint> {
  if (servicePoint.serviceIds?.length) {
    const result1 = await ddbDocClient.send(
      new BatchGetCommand({
        RequestItems: {
          [TableName]: {
            Keys: servicePoint.serviceIds.map((id) => ({
              PK: ServiceItem.prefixService,
              SK: ServiceItem.prefixService + id,
            })),
          },
        },
      })
    );

    if (
      result1?.Responses?.[TableName]?.length !== servicePoint.serviceIds.length
    ) {
      throw new Error("Service not found");
    }
  }

  const result = await ddbDocClient.send(
    new UpdateCommand({
      TableName,
      Key: new ServicePointItem(servicePoint).keys(),
      UpdateExpression:
        "SET " +
        Object.entries(servicePoint)
          .filter(([key, value]) => value !== undefined)
          .map(([key, value]) => `#${key} = :${key}`)
          .join(", "),
      ExpressionAttributeNames: Object.entries(servicePoint)
        .filter(([key, value]) => value !== undefined)
        .reduce((acc, [key, value]) => {
          acc[`#${key}`] = key;
          return acc;
        }, {}),
      ExpressionAttributeValues: Object.entries(servicePoint)

        .filter(([key, value]) => value !== undefined)
        .reduce((acc, [key, value]) => {
          acc[`:${key}`] = value;
          return acc;
        }, {}),
      ConditionExpression: "attribute_exists(PK) and attribute_exists(SK)",
      ReturnValues: "ALL_NEW",
    })
  );
  if (!result.Attributes) {
    throw new Error("Service point not found");
  }

  return new ServicePointItem(result.Attributes);
}

async function deleteServicePoint(servicePoint: Pick<IServicePoint, "id">) {
  const result = await ddbDocClient.send(
    new DeleteCommand({
      TableName,
      Key: new ServicePointItem(servicePoint).keys(),
      ConditionExpression: "attribute_exists(PK) and attribute_exists(SK)",
    })
  );
  return result;
}
const getServicePoint2 = async (id: string) => {
  const result = await ddbDocClient.send(
    new GetCommand({
      TableName,
      Key: new ServicePointItem({ id }).keys(),
    })
  );
  if (!result.Item) {
    throw new Error("Service point not found");
  }
  return ServicePointItem.fromItem(result.Item);
};

export async function notifyNewItem(serviceId: string) {
  // get all service point that has this service and servicePointStatus = "waiting" and don't have any item in queue
  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName,
      KeyConditionExpression: "PK = :pk and begins_with(SK, :sk)",
      FilterExpression:
        "servicePointStatus = :servicePointStatus and contains(serviceIds, :serviceId)",
      ExpressionAttributeValues: {
        ":pk": ServicePointItem.prefixServicePoint,
        ":sk": ServicePointItem.prefixServicePoint,
        ":servicePointStatus": ServicePointStatus.WAITING,
        ":serviceId": serviceId,
      },
      ProjectionExpression: "id",
    })
  );

  const servicePointIds = result?.Items?.map((item) => item.id) || [];

  // todo consider workload balancing between service points
  // now most of the time, the first service point will be selected
  for (const servicePointId of servicePointIds) {
    await updateServicePointStatus({
      id: servicePointId,
      servicePointStatus: ServicePointStatus.WAITING,
    });
  }
}

async function updateServicePointStatus({
  id,
  servicePointStatus: newServicePointStatus,
}: Pick<IServicePoint, "id" | "servicePointStatus">) {
  const servicePoint = await getServicePoint2(id);

  switch (servicePoint.servicePointStatus) {
    case ServicePointStatus.CLOSED:
      switch (newServicePointStatus) {
        case ServicePointStatus.WAITING:
          await startWaitingQueue(servicePoint);
          return;
        case ServicePointStatus.CLOSED:
          return;
        default:
          throw new Error("Invalid status");
      }
    case ServicePointStatus.WAITING:
      if (!servicePoint.serviceIds || servicePoint.serviceIds.length === 0) {
        throw new Error("Service point has no service");
      }

      switch (newServicePointStatus) {
        case ServicePointStatus.CLOSED:
          await putItemBackToQueue(servicePoint);
          await closeServicePoint(servicePoint);
          return;
        case ServicePointStatus.IN_SERVICE:
          await startServicingItemQueue(servicePoint);
          return;
        case ServicePointStatus.WAITING:
          await startWaitingQueue(servicePoint);
          return;
        default:
          throw new Error("Invalid status");
      }
    case ServicePointStatus.IN_SERVICE:
      switch (newServicePointStatus) {
        case ServicePointStatus.CLOSED:
          await markAsServed(servicePoint);
          await closeServicePoint(servicePoint);
          return;

        case ServicePointStatus.WAITING:
          await markAsServed(servicePoint);
          const servicePoint2 = await getServicePoint2(id);
          await startWaitingQueue(servicePoint2);
          return;
        case ServicePointStatus.IN_SERVICE:
          return;
        default:
          throw new Error("Invalid status");
      }
    case ServicePointStatus.SERVED:
      switch (newServicePointStatus) {
        case ServicePointStatus.CLOSED:
          await closeServicePoint(servicePoint);
          return;
        case ServicePointStatus.WAITING:
          await startWaitingQueue(servicePoint);
          return;
        case ServicePointStatus.SERVED:
          return;

        default:
          throw new Error("Invalid status");
      }
      break;
  }
}

export async function startWaitingQueue(servicePoint: ServicePointItem) {
  if (servicePoint.currentQueueItem) {
    return;
  }
  const items = await getItemsByStatus1({
    servicePoints: [servicePoint],
    limit: 1,
    queueStatus: QueueStatus.QUEUED,
  });
  const queueItem = items[0];
  if (!queueItem) {
    // waiting queue is empty
    // set service point status to waiting
    await ddbDocClient.send(
      new UpdateCommand({
        TableName,
        Key: servicePoint.keys(),
        UpdateExpression: "SET #servicePointStatus = :servicePointStatus",
        ExpressionAttributeNames: {
          "#servicePointStatus": "servicePointStatus",
        },
        ExpressionAttributeValues: {
          ":servicePointStatus": ServicePointStatus.WAITING,
        },
      })
    );
    return;
  }
  queueItem.queueStatus = QueueStatus.PENDING;
  queueItem.date = new Date().toISOString();

  await ddbDocClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: TableName,
            Key: queueItem.keys(),
            UpdateExpression:
              "SET #queueStatus = :queueStatus, #date = :date, #GSI1SK = :GSI1SK",
            ExpressionAttributeNames: {
              "#queueStatus": "queueStatus",
              "#date": "date",
              "#GSI1SK": "GSI1SK",
            },
            ExpressionAttributeValues: {
              ":queueStatus": queueItem.queueStatus,
              ":date": queueItem.date,
              ":GSI1SK": queueItem.GSI1SK,
            },
          },
        },
        {
          Update: {
            TableName: TableName,
            Key: servicePoint.keys(),
            UpdateExpression:
              "SET currentItem = :currentItem, servicePointStatus = :servicePointStatus",
            ExpressionAttributeValues: {
              ":currentItem": queueItem.id,
              ":servicePointStatus": ServicePointStatus.WAITING,
            },
            ConditionExpression:
              "attribute_exists(PK) and attribute_exists(SK)",
          },
        },
      ],
    })
  );
}

async function putItemBackToQueue(servicePoint: ServicePointItem) {
  if (!servicePoint.currentQueueItem) {
    return;
  }
  const res = await ddbDocClient.send(
    new GetCommand({
      TableName,
      Key: QueueItem.buildKey(servicePoint.currentQueueItem),
    })
  );

  if (!res.Item) {
    throw new Error("Queue item not found");
  }
  const queueItem = QueueItem.fromItem(res.Item);

  queueItem.queueStatus = QueueStatus.QUEUED;
  queueItem.date = new Date().toISOString();

  await ddbDocClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: TableName,
            Key: queueItem.keys(),
            UpdateExpression:
              "SET #queueStatus = :queueStatus, #date = :date, #GSI1SK = :GSI1SK",
            ExpressionAttributeNames: {
              "#queueStatus": "queueStatus",
              "#date": "date",
              "#GSI1SK": "GSI1SK",
            },
            ExpressionAttributeValues: {
              ":queueStatus": queueItem.queueStatus,
              ":date": queueItem.date,
              ":GSI1SK": queueItem.GSI1SK,
            },
          },
        },
        {
          Update: {
            TableName: TableName,
            Key: servicePoint.keys(),
            UpdateExpression: "SET currentItem = :currentItem",
            ExpressionAttributeValues: {
              ":currentItem": "",
            },
            ConditionExpression:
              "attribute_exists(PK) and attribute_exists(SK)",
          },
        },
      ],
    })
  );
}

async function startServicingItemQueue(servicePoint: ServicePointItem) {
  if (!servicePoint.currentQueueItem) {
    throw new Error("Queue item not defined");
  }
  const res = await ddbDocClient.send(
    new GetCommand({
      TableName,
      Key: QueueItem.buildKey(servicePoint.currentQueueItem),
    })
  );

  if (!res.Item) {
    throw new Error("Queue item not found");
  }
  const queueItem = QueueItem.fromItem(res.Item);
  queueItem.queueStatus = QueueStatus.IN_SERVICE;
  queueItem.date = new Date().toISOString();

  await ddbDocClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: TableName,
            Key: queueItem.keys(),
            UpdateExpression:
              "SET #queueStatus = :queueStatus, #date = :date, #GSI1SK = :GSI1SK",
            ExpressionAttributeNames: {
              "#queueStatus": "queueStatus",
              "#date": "date",
              "#GSI1SK": "GSI1SK",
            },
            ExpressionAttributeValues: {
              ":queueStatus": queueItem.queueStatus,
              ":date": queueItem.date,
              ":GSI1SK": queueItem.GSI1SK,
            },
          },
        },
        {
          Update: {
            TableName: TableName,
            Key: servicePoint.keys(),
            UpdateExpression:
              "SET servicePointStatus = :servicePointStatus, currentItem = :currentItem",
            ExpressionAttributeValues: {
              ":servicePointStatus": ServicePointStatus.IN_SERVICE,
              ":currentItem": queueItem.id,
            },

            ConditionExpression:
              "attribute_exists(PK) and attribute_exists(SK) and attribute_exists(currentItem)",
          },
        },
      ],
    })
  );
}

async function markAsServed(servicePoint: ServicePointItem) {
  if (!servicePoint.currentQueueItem) {
    throw new Error("Queue item not defined");
  }
  const res = await ddbDocClient.send(
    new GetCommand({
      TableName,
      Key: QueueItem.buildKey(servicePoint.currentQueueItem),
    })
  );
  if (!res.Item) {
    throw new Error("Queue item not found");
  }
  const queueItem = QueueItem.fromItem(res.Item);
  queueItem.queueStatus = QueueStatus.SERVED;
  queueItem.date = new Date().toISOString();

  await ddbDocClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: TableName,
            Key: queueItem.keys(),
            UpdateExpression:
              "SET #queueStatus = :queueStatus, #date = :date, #GSI1SK = :GSI1SK",
            ExpressionAttributeNames: {
              "#queueStatus": "queueStatus",
              "#date": "date",
              "#GSI1SK": "GSI1SK",
            },
            ExpressionAttributeValues: {
              ":queueStatus": queueItem.queueStatus,
              ":date": queueItem.date,
              ":GSI1SK": queueItem.GSI1SK,
            },
            ConditionExpression:
              "attribute_exists(PK) and attribute_exists(SK)",
          },
        },
        {
          Update: {
            TableName: TableName,
            Key: servicePoint.keys(),
            UpdateExpression:
              "SET currentItem = :currentItem, servicePointStatus = :servicePointStatus ",
            ExpressionAttributeValues: {
              ":currentItem": "",
              ":servicePointStatus": ServicePointStatus.SERVED,
            },
            ConditionExpression:
              "attribute_exists(PK) and attribute_exists(SK) and attribute_exists(currentItem)",
          },
        },
      ],
    })
  );
}

async function closeServicePoint(servicePoint: ServicePointItem) {
  await ddbDocClient.send(
    new UpdateCommand({
      TableName,
      Key: servicePoint.keys(),
      UpdateExpression: "SET servicePointStatus = :servicePointStatus",
      ExpressionAttributeValues: {
        ":servicePointStatus": ServicePointStatus.CLOSED,
      },
      ConditionExpression:
        "attribute_exists(PK) and attribute_exists(SK) and servicePointStatus <> :servicePointStatus",
    })
  );
}
