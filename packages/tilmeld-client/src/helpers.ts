import User, { ClientConfig, CurrentUserData } from './User';

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
};

let clientConfig: ClientConfig | null = null;
let clientConfigPromise: Promise<ClientConfig> | null = null;

export async function getClientConfig() {
  if (clientConfig) {
    return clientConfig;
  }
  if (!clientConfigPromise) {
    clientConfigPromise = User.getClientConfig().then(
      (config) => (clientConfig = config)
    );
  }
  return await clientConfigPromise;
}

export async function login(username: string, password: string) {
  if (username === '') {
    throw new Error('You need to enter a username.');
  }
  if (password === '') {
    throw new Error('You need to enter a password');
  }

  try {
    const { result, ...response } = await User.loginUser({
      username,
      password,
    });
    if (!result) {
      throw new Error(response.message);
    }
    return response;
  } catch (e: any) {
    throw new Error(e?.message ?? 'An error occurred.');
  }
}

export async function register(userDetails: RegistrationDetails): Promise<{
  loggedin: boolean;
  message: string;
  user?: User & CurrentUserData;
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
  let user = User.factorySync() as User & CurrentUserData;
  user.username = userDetails.username;
  const config = await getClientConfig();

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
    });
    if (!result) {
      throw new Error(response.message);
    }
    return { ...response, user };
  } catch (e: any) {
    throw new Error(e?.message ?? 'An error occurred.');
  }
}

export async function checkUsername(username: string) {
  let user = User.factorySync() as User & CurrentUserData;
  user.username = username;

  const config = await getClientConfig();
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
