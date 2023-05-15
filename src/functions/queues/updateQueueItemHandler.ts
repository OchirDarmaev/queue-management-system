import { check } from "../../auth/check";
import { EAction } from "../../auth/enums/action.enum";
import { ESubject } from "../../auth/enums/subject.enum";
import { updateQueueItem } from "./queue";

export async function updateQueueItemHandler(event, context) {
  if (!check(event, EAction.Update, ESubject.QueueItem)) {
    return {
      statusCode: 403,
      body: `Forbidden`,
    };
  }
  try {
    const queueId = event.pathParameters?.queueId;
    if (!queueId) {
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
    const { priority } = JSON.parse(event.body);
    if (!priority) {
      return {
        statusCode: 400,
        body: "Bad Request",
      };
    }
    const res = await updateQueueItem({
      queueId,
      priority,
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
}
