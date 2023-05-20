import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { IService } from "../model/service.interface.js";
import { ServiceItem } from "../model/service-item.js";
import { ddbDocClient } from "../../../ddb-doc-client.js";
import { TableName } from "../../../table-name.js";

export async function getService({ id }: { id: string }): Promise<IService> {
  const result = await ddbDocClient.send(
    new GetCommand({ TableName, Key: ServiceItem.buildKey(id) })
  );

  if (!result.Item) {
    throw new Error("Not Found");
  }
  return ServiceItem.fromItem(result.Item);
}
