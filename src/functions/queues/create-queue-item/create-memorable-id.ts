import { UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDocClient } from "../../../dynamo-DB-client";
import { TableName } from "../../../table-name";
import createError from "http-errors";
import { ServiceItem } from "../../services/model/service-item";

/**
 * Pool ids '[A-z]-[0-9]{3}' (e.g. A-001...Z-999)
 * */
// todo Rotate pool ids every 1000 ids

export async function createMemorableId(serviceId: string): Promise<string> {
  const prefixPoolIds = "PI#";
  const serviceItem = await ddbDocClient.send(
    new GetCommand({
      TableName,
      Key: {
        PK: ServiceItem.prefixService,
        SK: ServiceItem.prefixService + serviceId,
      },
    })
  );

  if (!serviceItem.Item) {
    throw createError(404, {
      message: "Service not found",
    });
  }

  const serviceName = serviceItem.Item.name;
  const firstLetterServiceName = serviceName[0];
  // Pool name is hardcoded for now
  const poolName = "FirstPool";
  const res = await ddbDocClient.send(
    new UpdateCommand({
      TableName,
      Key: {
        PK: prefixPoolIds + poolName,
        SK: firstLetterServiceName,
      },
      UpdateExpression: "ADD #counter :increment",
      ExpressionAttributeNames: {
        "#counter": "counter",
      },
      ExpressionAttributeValues: {
        ":increment": 1,
      },
      ReturnValues: "ALL_NEW",
    })
  );

  const counter = res.Attributes?.counter;

  return firstLetterServiceName + "-" + counter.toString().padStart(3, "0");
}
