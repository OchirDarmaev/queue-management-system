//test handler to log to console
// event is dynamodb stream event
export const handler = async (event, _context) => {
  // log event to dynamodb table
  console.log(JSON.stringify(event, null, 2));
  console.log("Hello World");
};
