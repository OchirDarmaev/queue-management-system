import { CognitoIdentityServiceProvider } from "aws-sdk";

const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider();

export const authenticateUser = async (
  username: string,
  password: string
): Promise<void> => {
  const params = {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: process.env.COGNITO_CLIENT_ID,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
    },
  };
};
