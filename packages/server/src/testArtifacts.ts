import { Entity as EntityServer, EntityInvalidDataError } from '@nymphjs/nymph';
import { Entity } from '@nymphjs/client';

import { HttpError } from './HttpError';

export type EmployeeBaseData<T> = {
  name?: string;
  id?: number;
  title?: string;
  department?: string;
  subordinates?: T[];
  salary?: number;
  current?: boolean;
  startDate?: number;
  endDate?: number;
  phone?: string;

  building?: string;

  thing?: string;
  other?: string;
};

export type EmployeeModelData = EmployeeBaseData<EmployeeModel>;

const IS_MANAGER = true;

/**
 * This class is a test class that extends the Entity class.
 */
export class EmployeeModel extends EntityServer<EmployeeModelData> {
  static ETYPE = 'employee';
  static class = 'Employee';

  protected $clientEnabledMethods = [
    '$testMethodStateless',
    '$testMethod',
    '$throwError',
    '$throwHttpError',
    '$throwHttpErrorWithDescription',
  ];
  public static clientEnabledStaticMethods = [
    'testStatic',
    'testStaticIterable',
    'testStaticIterableAbort',
    'throwErrorStatic',
    'throwErrorStaticIterable',
  ];
  protected $protectedTags = ['employee'];
  protected $allowlistTags? = ['boss', 'bigcheese'];
  protected $allowlistData? = [
    'name',
    'id',
    'title',
    'department',
    'subordinates',
    'salary',
    'current',
    'startDate',
    'endDate',
    'phone',
    'manager',
    'building',
  ];

  static async factory(
    guid?: string
  ): Promise<EmployeeModel & EmployeeModelData> {
    return (await super.factory(guid)) as EmployeeModel & EmployeeModelData;
  }

  static factorySync(guid?: string): EmployeeModel & EmployeeModelData {
    return super.factorySync(guid) as EmployeeModel & EmployeeModelData;
  }

  constructor(guid?: string) {
    super(guid);

    if (this.guid == null) {
      this.$addTag('employee');
      this.$data.current = true;
      this.$data.startDate = Date.now();
      this.$data.subordinates = [];
      if (!IS_MANAGER) {
        this.$privateData.push('salary');
      }
    }
  }

  public async $save() {
    // Validate employee data.
    const error = new EntityInvalidDataError('Invalid entity data.');
    if (this.$data.name == null || this.$data.name === '') {
      error.addField('name');
    }
    if (this.$data.title == null || this.$data.title === '') {
      error.addField('title');
    }
    if (this.$data.startDate == null) {
      error.addField('startDate');
    }
    if (error.getFields().length) {
      throw error;
    }
    // Generate employee ID.
    if (this.$data.id == null) {
      this.$data.id = (await this.$nymph.newUID('employee')) ?? undefined;
    }
    return await super.$save();
  }

  public $testMethodStateless(value: number) {
    this.$data.name = 'bad name';
    return value + 1;
  }

  public $testMethod(value: number) {
    this.$data.current = false;
    return value + 2;
  }

  public static testStatic(value: number) {
    return value * 2;
  }

  public static *testStaticIterable(value: number) {
    yield value + 1;
    yield value + 2;
    yield value + 3;
  }

  public static *testStaticIterableAbort(): Iterator<number, void, boolean> {
    let aborted = yield 1;

    if (!aborted) {
      throw new Error(
        "testStaticIterableAbort wasn't aborted after the first iteration."
      );
    }
  }

  public static throwErrorStatic() {
    throw new BadFunctionCallError('This function only throws errors.');
  }

  public static *throwErrorStaticIterable() {
    yield 1;
    throw new BadFunctionCallError(
      'This function throws errors after the first iteration.'
    );
  }

  public $throwError() {
    throw new BadFunctionCallError('This function only throws errors.');
  }

  public $throwHttpError() {
    throw new HttpError('A 501 HTTP error.', 501);
  }

  public $throwHttpErrorWithDescription() {
    throw new HttpError('A 512 HTTP error.', 512, 'Some Error');
  }

  public static inaccessibleMethod() {
    return true;
  }
}

export class BadFunctionCallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadFunctionCallError';
  }
}

export type EmployeeData = EmployeeBaseData<Employee>;

export class Employee extends Entity<EmployeeData> {
  // The name of the server class
  public static class = 'Employee';

  constructor(guid?: string) {
    super(guid);

    if (guid == null) {
      this.$addTag('employee');
      this.$data.current = true;
      this.$data.subordinates = [];
    }
  }

  static async factory(guid?: string): Promise<Employee & EmployeeData> {
    return (await super.factory(guid)) as Employee & EmployeeData;
  }

  static factorySync(guid?: string): Employee & EmployeeData {
    return super.factorySync(guid) as Employee & EmployeeData;
  }

  $testMethod(value: number) {
    return this.$serverCall('$testMethod', [value]);
  }

  $testMethodStateless(value: number) {
    return this.$serverCall('$testMethodStateless', [value], true);
  }

  $throwError() {
    return this.$serverCall('$throwError', []);
  }

  $throwHttpError() {
    return this.$serverCall('$throwHttpError', []);
  }

  $throwHttpErrorWithDescription() {
    return this.$serverCall('$throwHttpErrorWithDescription', []);
  }

  static testStatic(value: number) {
    return this.serverCallStatic('testStatic', [value]);
  }

  static testStaticIterable(value: number) {
    return this.serverCallStaticIterator('testStaticIterable', [value]);
  }

  static testStaticIterableAbort() {
    return this.serverCallStaticIterator('testStaticIterableAbort', []);
  }

  static throwErrorStatic() {
    return this.serverCallStatic('throwErrorStatic', []);
  }

  static throwErrorStaticIterable() {
    return this.serverCallStaticIterator('throwErrorStaticIterable', []);
  }

  static inaccessibleMethod() {
    return this.serverCallStatic('inaccessibleMethod', []);
  }
}

export type RestrictedModelData = {
  name: string;
};

/**
 * This class is a test class that extends the Entity class.
 */
export class RestrictedModel extends EntityServer<RestrictedModelData> {
  static ETYPE = 'restricted';
  static class = 'Restricted';

  public static restEnabled = false;

  static async factory(
    guid?: string
  ): Promise<RestrictedModel & RestrictedModelData> {
    return (await super.factory(guid)) as RestrictedModel & RestrictedModelData;
  }

  static factorySync(guid?: string): RestrictedModel & RestrictedModelData {
    return super.factorySync(guid) as RestrictedModel & RestrictedModelData;
  }

  constructor(guid?: string) {
    super(guid);

    if (this.guid == null) {
      this.$data.name = '';
    }
  }

  public async $save() {
    // Validate entity data.
    const error = new EntityInvalidDataError('Invalid entity data.');
    if (this.$data.name == null || this.$data.name === '') {
      error.addField('name');
    }
    if (error.getFields().length) {
      throw error;
    }
    return await super.$save();
  }

  $testMethod(value: string) {
    return value;
  }

  public static testStatic(value: number) {
    return value;
  }
}

export type RestrictedData = {
  name: string;
};

export class Restricted extends Entity<RestrictedData> {
  // The name of the server class
  public static class = 'Restricted';

  constructor(guid?: string) {
    super(guid);

    if (guid == null) {
      this.$data.name = '';
    }
  }

  static async factory(guid?: string): Promise<Restricted & RestrictedData> {
    return (await super.factory(guid)) as Restricted & RestrictedData;
  }

  static factorySync(guid?: string): Restricted & RestrictedData {
    return super.factorySync(guid) as Restricted & RestrictedData;
  }

  $testMethod(value: number) {
    return this.$serverCall('$testMethod', [value]);
  }

  static testStatic(value: number) {
    return this.serverCallStatic('testStatic', [value]);
  }
}

export type PubSubDisabledModelData = {
  name: string;
};

/**
 * This class is a test class that extends the Entity class.
 */
export class PubSubDisabledModel extends EntityServer<PubSubDisabledModelData> {
  static ETYPE = 'pubsub_disabled';
  static class = 'PubSubDisabled';

  public static pubSubEnabled = false;

  static async factory(
    guid?: string
  ): Promise<PubSubDisabledModel & PubSubDisabledModelData> {
    return (await super.factory(guid)) as PubSubDisabledModel &
      PubSubDisabledModelData;
  }

  static factorySync(
    guid?: string
  ): PubSubDisabledModel & PubSubDisabledModelData {
    return super.factorySync(guid) as PubSubDisabledModel &
      PubSubDisabledModelData;
  }

  constructor(guid?: string) {
    super(guid);

    if (guid == null) {
      this.$data.name = '';
    }
  }

  public async $save() {
    // Validate entity data.
    const error = new EntityInvalidDataError('Invalid entity data.');
    if (this.$data.name == null || this.$data.name === '') {
      error.addField('name');
    }
    if (error.getFields().length) {
      throw error;
    }
    return await super.$save();
  }
}

export type PubSubDisabledData = {
  name: string;
};

export class PubSubDisabled extends Entity<PubSubDisabledData> {
  // The name of the server class
  public static class = 'PubSubDisabled';

  constructor(guid?: string) {
    super(guid);

    if (guid == null) {
      this.$data.name = '';
    }
  }

  static async factory(
    guid?: string
  ): Promise<PubSubDisabled & PubSubDisabledData> {
    return (await super.factory(guid)) as PubSubDisabled & PubSubDisabledData;
  }

  static factorySync(guid?: string): PubSubDisabled & PubSubDisabledData {
    return super.factorySync(guid) as PubSubDisabled & PubSubDisabledData;
  }
}
