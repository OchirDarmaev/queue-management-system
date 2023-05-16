import {
  APIGatewayProxyHandlerV2WithJWTAuthorizer,
  DynamoDBStreamHandler,
} from "aws-lambda";
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
import { getItemsBy } from "../functions/boards/get-items-by";
import { QueueItem } from "../functions/queues/model/queue-item";
import { ServiceItem } from "../services/ServiceItem";
import { ServicePointStatus } from "./ServicePointStatus";
import { IServicePoint } from "./IServicePoint";
import { ServicePointItem } from "./ServicePointItem";
import { check } from "../auth/check";
import { EAction } from "../auth/enums/action.enum";
import { ESubject } from "../auth/enums/subject.enum";
import { EQueueStatus } from "../functions/queues/enums/queue-status.enum";

export const createServicePointHandler: APIGatewayProxyHandlerV2WithJWTAuthorizer =
  async (event, context) => {
    if (!check(event, EAction.Create, ESubject.ServicePoint)) {
      return {
        statusCode: 403,
        body: `Forbidden`,
      };
    }

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

export const getServicePointHandler: APIGatewayProxyHandlerV2WithJWTAuthorizer =
  async (event, context) => {
    if (!check(event, EAction.Read, ESubject.ServicePoint)) {
      return {
        statusCode: 403,
        body: `Forbidden`,
      };
    }

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

export const getServicePointsHandler: APIGatewayProxyHandlerV2WithJWTAuthorizer<
  IServicePoint[]
> = async (event, context) => {
  if (!check(event, EAction.Read, ESubject.ServicePoint)) {
    return {
      statusCode: 403,
      body: `Forbidden`,
    };
  }

  try {
    const res = await getServicePoints();
    return res;
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: "Internal Server Error",
    };
  }
};

export const updateServicePointHandler: APIGatewayProxyHandlerV2WithJWTAuthorizer =
  async (event, context) => {
    if (!check(event, EAction.Update, ESubject.ServicePoint)) {
      return {
        statusCode: 403,
        body: `Forbidden`,
      };
    }

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
      const { serviceIds, servicePointNumber, name, description } = JSON.parse(
        event.body
      );
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

export const removeServicePointHandler: APIGatewayProxyHandlerV2WithJWTAuthorizer =
  async (event, context) => {
    if (!check(event, EAction.Delete, ESubject.ServicePoint)) {
      return {
        statusCode: 403,
        body: `Forbidden`,
      };
    }

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

export const updateServicePointStatusHandler: APIGatewayProxyHandlerV2WithJWTAuthorizer =
  async (event, context) => {
    if (!check(event, EAction.UpdateStatus, ESubject.ServicePoint)) {
      return {
        statusCode: 403,
        body: `Forbidden`,
      };
    }

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
  console.log("records", JSON.stringify(records, null, 2));

  for (const record of records) {
    if (record.eventName === "INSERT") {
      const newImage = record.dynamodb?.NewImage;
      if (!newImage) {
        continue;
      }
      const prefix = newImage.PK?.S;
      if (prefix !== QueueItem.prefix) {
        console.log("prefix is not queue" + prefix);

        continue;
      }
      const serviceId = newImage.serviceId?.S;
      if (!serviceId) {
        throw new Error("serviceId is not defined");
      }
      await notifyNewItem(serviceId);
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
    throw new Error("Service point not found 1");
  }

  return ServicePointItem.fromItem(result.Item);
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
    throw new Error("Service point not found 2");
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
    throw new Error("Service point not found 3");
  }
  return ServicePointItem.fromItem(result.Item);
};

async function notifyNewItem(serviceId: string) {
  // get all service point that has this service and servicePointStatus = "waiting" and don't have any item in queue
  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName,
      KeyConditionExpression: "PK = :pk and begins_with(SK, :sk)",
      FilterExpression:
        "servicePointStatus = :servicePointStatus and contains(serviceIds, :serviceId) and currentQueueItem = :empty",
      ExpressionAttributeValues: {
        ":pk": ServicePointItem.prefixServicePoint,
        ":sk": ServicePointItem.prefixServicePoint,
        ":servicePointStatus": ServicePointStatus.WAITING,
        ":serviceId": serviceId,
        ":empty": "",
      },
      ProjectionExpression: "SK, servicePointStatus",
    })
  );

  if (!result?.Items?.length) {
    return;
  }

  const servicePointIds = result.Items.map(
    (item) => ServicePointItem.fromItem(item).id
  );

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
  console.log("status", servicePoint.servicePointStatus, newServicePointStatus);
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
  }
}

export async function startWaitingQueue(servicePoint: ServicePointItem) {
  if (servicePoint.currentQueueItem) {
    return;
  }
  const items = await getItemsBy({
    servicePoints: [servicePoint],
    limit: 1,
    queueStatus: EQueueStatus.QUEUED,
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
  queueItem.queueStatus = EQueueStatus.PENDING;


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
              "SET currentQueueItem = :currentQueueItem, servicePointStatus = :servicePointStatus",
            ExpressionAttributeValues: {
              ":currentQueueItem": queueItem.id,
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

  queueItem.queueStatus = EQueueStatus.QUEUED;

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
            UpdateExpression: "SET currentQueueItem = :currentQueueItem",
            ExpressionAttributeValues: {
              ":currentQueueItem": "",
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
  queueItem.queueStatus = EQueueStatus.IN_SERVICE;

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
              "SET servicePointStatus = :servicePointStatus, currentQueueItem = :currentQueueItem",
            ExpressionAttributeValues: {
              ":servicePointStatus": ServicePointStatus.IN_SERVICE,
              ":currentQueueItem": queueItem.id,
            },

            ConditionExpression:
              "attribute_exists(PK) and attribute_exists(SK) and attribute_exists(currentQueueItem)",
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
  queueItem.queueStatus = EQueueStatus.SERVED;


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
              "SET currentQueueItem = :currentQueueItem, servicePointStatus = :servicePointStatus ",
            ExpressionAttributeValues: {
              ":currentQueueItem": "",
              ":servicePointStatus": ServicePointStatus.SERVED,
            },
            ConditionExpression:
              "attribute_exists(PK) and attribute_exists(SK) and attribute_exists(currentQueueItem)",
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
