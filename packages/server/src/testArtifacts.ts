import { Entity as EntityServer, EntityInvalidDataError } from '@nymphjs/nymph';
import { Entity } from '@nymphjs/client';

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
  ];
  public static clientEnabledStaticMethods = ['testStatic', 'throwErrorStatic'];
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
    if (this.$data.name == null || this.$data.name == '') {
      error.addField('name');
    }
    if (this.$data.title == null || this.$data.title == '') {
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

  public static throwErrorStatic() {
    throw new BadFunctionCallError('This function only throws errors.');
  }

  public $throwError() {
    throw new BadFunctionCallError('This function only throws errors.');
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

  static testStatic(value: number) {
    return Employee.serverCallStatic('testStatic', [value]);
  }

  static throwErrorStatic() {
    return Employee.serverCallStatic('throwErrorStatic', []);
  }

  static inaccessibleMethod() {
    return Employee.serverCallStatic('inaccessibleMethod', []);
  }
}

export default Employee;
