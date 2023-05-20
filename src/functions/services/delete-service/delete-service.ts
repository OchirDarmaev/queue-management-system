import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { ServiceItem } from "../model/service-item.js";
import { ddbDocClient } from "../../../ddb-doc-client.js";
import { TableName } from "../../../table-name.js";

export async function deleteService({ id }: { id: string }) {
  await ddbDocClient.send(
    new DeleteCommand({
      TableName,
      Key: {
        PK: ServiceItem.prefixService,
        SK: ServiceItem.prefixService + id,
      },
      ConditionExpression: "attribute_exists(PK) and attribute_exists(SK)",
    })
  );
}
