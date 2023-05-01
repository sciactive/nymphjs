import type UserClass from './User';
import type { ClientConfig, CurrentUserData } from './User';

export type RegistrationDetails = {
  /**
   * New user's username.
   */
  username: string;
  /**
   * New user's password.
   */
  password: string;
  /**
   * Repeat the password.
   */
  password2: string;
  /**
   * Whether the username passed verification.
   */
  usernameVerified: boolean;
  /**
   * The new user's email address.
   */
  email?: string;
  /**
   * The new user's given name.
   */
  nameFirst?: string;
  /**
   * The new user's surname.
   */
  nameLast?: string;
  /**
   * The new user's phone number.
   */
  phone?: string;
  /**
   * Additional data to be included in the request.
   */
  additionalData?: { [k: string]: any };
};

export class NeedTOTPError extends Error {}

export async function login(
  User: typeof UserClass,
  username: string,
  password: string,
  code?: string,
  additionalData?: { [k: string]: any }
) {
  if (username === '') {
    throw new Error('You need to enter a username.');
  }
  if (password === '') {
    throw new Error('You need to enter a password');
  }

  try {
    const { result, needTOTP, ...response } = await User.loginUser({
      username,
      password,
      code,
      ...(additionalData ? { additionalData } : {}),
    });
    if (!result) {
      if (needTOTP) {
        throw new NeedTOTPError(response.message);
      }

      throw new Error(response.message);
    }
    return response;
  } catch (e: any) {
    if (e instanceof NeedTOTPError) {
      throw e;
    }
    throw new Error(e?.message ?? 'An error occurred.');
  }
}

export async function register(
  User: typeof UserClass,
  userDetails: RegistrationDetails,
  clientConfig?: ClientConfig
): Promise<{
  loggedin: boolean;
  message: string;
  user?: UserClass & CurrentUserData;
}> {
  if (userDetails.username === '') {
    throw new Error('You need to enter a username.');
  }
  if (!userDetails.usernameVerified) {
    throw new Error('The username you entered is not valid.');
  }
  if (userDetails.password !== userDetails.password2) {
    throw new Error('Your passwords do not match.');
  }
  if (userDetails.password === '') {
    throw new Error('You need to enter a password');
  }

  // Create a new user.
  let user = User.factorySync() as UserClass & CurrentUserData;
  user.username = userDetails.username;
  const config = clientConfig || (await User.getClientConfig());

  if (config.emailUsernames) {
    user.email = userDetails.username;
  } else if (config.regFields.indexOf('email') !== -1) {
    user.email = userDetails.email;
  }
  if (config.regFields.indexOf('name') !== -1) {
    user.nameFirst = userDetails.nameFirst;
    user.nameLast = userDetails.nameLast;
  }
  if (config.regFields.indexOf('phone') !== -1) {
    user.phone = userDetails.phone;
  }

  try {
    const { result, ...response } = await user.$register({
      password: userDetails.password,
      ...(userDetails.additionalData
        ? { additionalData: userDetails.additionalData }
        : {}),
    });
    if (!result) {
      throw new Error(response.message);
    }
    return { ...response, user };
  } catch (e: any) {
    throw new Error(e?.message ?? 'An error occurred.');
  }
}

export async function checkUsername(
  User: typeof UserClass,
  username: string,
  clientConfig?: ClientConfig
) {
  let user = User.factorySync() as UserClass & CurrentUserData;
  user.username = username;

  const config = clientConfig || (await User.getClientConfig());
  if (config.emailUsernames) {
    user.email = username;
  }

  try {
    const { result, ...response } = await user.$checkUsername();
    if (!result) {
      throw new Error(response.message);
    }
    return response;
  } catch (e: any) {
    throw new Error(e?.message ?? 'An error occurred.');
  }
}
