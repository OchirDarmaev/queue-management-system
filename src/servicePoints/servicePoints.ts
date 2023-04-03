import { APIGatewayProxyHandler } from "aws-lambda";
import { ddbDocClient } from "../dynamoDB";
import {
  BatchGetCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ulid } from "ulid";
import { TableName } from "../db";
import { getItemsByStatus, QueueItem, QueueStatus } from "../queue/queue";
import { Item } from "../baseItem";
import { ServiceItem } from "../services/services";

export enum ServicePointStatus {
  WAITING = "waiting",
  IN_SERVICE = "in-service",
  CLOSED = "closed",
}

export type IServicePoint = {
  id: string;
  serviceIds: string[];
  name: string;
  description: string;
  servicePointStatus: ServicePointStatus;
  currentItem?: {
    PK: string;
    SK: string;
  };
};

export class ServicePointItem extends Item {
  static prefixServicePoint = "SP#";
  public id: string;
  public serviceIds: string[];
  public name: string;
  public description: string;
  public servicePointStatus: ServicePointStatus;
  public currentQueueItem?: {
    PK: string;
    SK: string;
  };
  constructor(servicePoint: Partial<IServicePoint>) {
    super();
    this.id = servicePoint.id || ulid();
    this.serviceIds = servicePoint.serviceIds || [];
    this.name = servicePoint.name || "";
    this.description = servicePoint.description || "";
    this.servicePointStatus =
      servicePoint.servicePointStatus || ServicePointStatus.CLOSED;
    this.currentQueueItem = servicePoint.currentItem;
  }

  get PK(): string {
    return ServicePointItem.prefixServicePoint;
  }

  get SK(): string {
    return ServicePointItem.prefixServicePoint + this.id;
  }

  static fromItem(item: Record<string, unknown>): ServicePointItem {
    return new ServicePointItem({
      id: (item.SK as string).replace(ServicePointItem.prefixServicePoint, ""),
      serviceIds: item.serviceIds as string[],
      name: item.name as string,
      description: item.description as string,
      servicePointStatus: item.servicePointStatus as ServicePointStatus,
      currentItem: item.currentItem as {
        PK: string;
        SK: string;
      },
    });
  }

  toItem(): Record<string, unknown> {
    return {
      ...this.keys(),
      serviceIds: this.serviceIds,
      name: this.name,
      description: this.description,
      servicePointStatus: this.servicePointStatus,
      currentItem: this.currentQueueItem,
    };
  }

  static buildKey(queueId: string): {
    PK: string;
    SK: string;
  } {
    return {
      PK: ServicePointItem.prefixServicePoint,
      SK: ServicePointItem.prefixServicePoint + queueId,
    };
  }
}

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
    const { servicePointId, serviceIds, name, description } = JSON.parse(
      event.body
    );
    const res = await createServicePoint({
      id: servicePointId,
      serviceIds,
      name,
      description,
      servicePointStatus: ServicePointStatus.CLOSED,
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
    const { serviceIds, name, description, status } = JSON.parse(event.body);
    const res = await updateServicePoint({
      id: servicePointId,
      serviceIds,
      name,
      description,
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

async function getServicePoints() {
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

async function updateServicePointStatus({
  id,
  servicePointStatus: newServicePointStatus,
}: Pick<IServicePoint, "id" | "servicePointStatus">) {
  const result = await ddbDocClient.send(
    new GetCommand({
      TableName,
      Key: new ServicePointItem({ id }).keys(),
    })
  );
  if (!result.Item) {
    throw new Error("Service point not found");
  }
  const servicePoint = ServicePointItem.fromItem(result.Item);

  if (servicePoint.servicePointStatus === newServicePointStatus) {
    return;
  }

  switch (servicePoint.servicePointStatus) {
    case ServicePointStatus.CLOSED:
      switch (newServicePointStatus) {
        case ServicePointStatus.IN_SERVICE:
          throw new Error("Service point is closed");
        case ServicePointStatus.WAITING:
          await startWaitingQueue(servicePoint);
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
          await startWaitingQueue(servicePoint);
          return;
        default:
          throw new Error("Invalid status");
      }
      break;
  }
}

async function startWaitingQueue(servicePoint: ServicePointItem) {
  if (!servicePoint.currentQueueItem) {
    const itemsByStatus = await getItemsByStatus({
      serviceIds: servicePoint.serviceIds,
      queueStatuses: [QueueStatus.QUEUED],
      limit: 1,
    });
    const queueItem = itemsByStatus[QueueStatus.QUEUED]?.[0];
    if (!queueItem) {
      throw new Error("No item in queue");
    }

    queueItem.queueStatus = QueueStatus.PENDING;

    await ddbDocClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: TableName,
              Key: queueItem.keys(),
              UpdateExpression:
                "SET #queueStatus = :queueStatus, GSI1SK = :gsi1sk",
              ExpressionAttributeNames: {
                "#queueStatus": "queueStatus",
              },
              ExpressionAttributeValues: {
                ":queueStatus": queueItem.queueStatus,
                ":gsi1sk": queueItem.GSI1SK,
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
                "SET currentItem = :currentItem, servicePointStatus = :servicePointStatus",
              ExpressionAttributeValues: {
                ":currentItem": queueItem.keys(),
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
}

async function putItemBackToQueue(servicePoint: ServicePointItem) {
  const res = await ddbDocClient.send(
    new GetCommand({
      TableName,
      Key: servicePoint.currentQueueItem,
    })
  );

  if (!res.Item) {
    throw new Error("Queue item not found");
  }
  const queueItem = QueueItem.fromItem(res.Item);
  queueItem.queueStatus = QueueStatus.QUEUED;

  await ddbDocClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: TableName,
            Key: queueItem.keys(),
            UpdateExpression:
              "SET queueStatus = :queueStatus, GSI1SK = :gsi1sk",
            ExpressionAttributeValues: {
              ":queueStatus": queueItem.queueStatus,
              ":gsi1sk": queueItem.GSI1SK,
            },
            ConditionExpression:
              "attribute_exists(PK) and attribute_exists(SK)",
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
  const res = await ddbDocClient.send(
    new GetCommand({
      TableName,
      Key: servicePoint.currentQueueItem,
    })
  );

  if (!res.Item) {
    throw new Error("Queue item not found");
  }
  const queueItem = QueueItem.fromItem(res.Item);
  queueItem.queueStatus = QueueStatus.IN_SERVICE;

  await ddbDocClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: TableName,
            Key: queueItem.keys(),
            UpdateExpression:
              "SET queueStatus = :queueStatus, GSI1SK = :gsi1sk",
            ExpressionAttributeValues: {
              ":queueStatus": queueItem.queueStatus,
              ":gsi1sk": queueItem.GSI1SK,
            },
          },
        },
        {
          Update: {
            TableName: TableName,
            Key: servicePoint.keys(),
            UpdateExpression: "SET servicePointStatus = :servicePointStatus",
            ExpressionAttributeValues: {
              ":servicePointStatus": ServicePointStatus.IN_SERVICE,
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
  const res = await ddbDocClient.send(
    new GetCommand({
      TableName,
      Key: servicePoint.currentQueueItem,
    })
  );

  if (!res.Item) {
    throw new Error("Queue item not found");
  }
  const queueItem = QueueItem.fromItem(res.Item);
  queueItem.queueStatus = QueueStatus.SERVED;

  await ddbDocClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: TableName,
            Key: queueItem.keys(),
            UpdateExpression:
              "SET queueStatus = :queueStatus, GSI1SK = :gsi1sk",
            ExpressionAttributeValues: {
              ":queueStatus": queueItem.queueStatus,
              ":gsi1sk": queueItem.GSI1SK,
            },
            ConditionExpression:
              "attribute_exists(PK) and attribute_exists(SK)",
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

export async function getServiceFromServicePointsIds(): Promise<string[]> {
  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: {
        ":pk": ServicePointItem.prefixServicePoint,
      },
      ProjectionExpression: "serviceIds",
      Select: "SPECIFIC_ATTRIBUTES",
    })
  );

  if (!result.Items?.length) {
    return [];
  }

  return [...new Set(result.Items.flatMap((item) => item.serviceIds))];
}
