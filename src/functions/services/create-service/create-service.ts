import { ulid } from "ulid";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { IService } from "../model/service.interface.js";
import { ServiceItem } from "../model/service-item.js";
import { ddbDocClient } from "../../../dynamo-DB-client.js";
import { TableName } from "../../../table-name.js";

export async function createService({
  name,
  description,
}: {
  name: string;
  description: string;
}): Promise<IService> {
  const id = ulid();
  const serviceItem = new ServiceItem({ id, name, description });

  await ddbDocClient.send(
    new PutCommand({
      TableName,
      Item: serviceItem.toItem(),
    })
  );

  return {
    id: id,
    name: name,
    description: description,
  };
}
