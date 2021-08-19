import NymphServer, {
  Entity as EntityServer,
  EntityInvalidDataError,
  InvalidParametersError,
} from '@nymphjs/nymph';
import { Nymph } from '@nymphjs/client-node';
import { Entity } from '@nymphjs/client';

export type EmployeeData = {
  name?: string;
  id?: number;
  title?: string;
  department?: string;
  subordinates?: EmployeeModel[];
  salary?: number;
  current?: boolean;
  startDate?: number;
  endDate?: number;
  phone?: string;
};

const IS_MANAGER = true;

/**
 * This class is a test class that extends the Entity class.
 */
export class EmployeeModel extends EntityServer<EmployeeData> {
  static ETYPE = 'employee';
  static class = 'Employee';

  protected $clientEnabledMethods = ['throwError'];
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

  static async factory(guid?: string): Promise<EmployeeModel & EmployeeData> {
    return (await super.factory(guid)) as EmployeeModel & EmployeeData;
  }

  static factorySync(guid?: string): EmployeeModel & EmployeeData {
    return super.factorySync(guid) as EmployeeModel & EmployeeData;
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
    if (error.getFields()) {
      throw error;
    }
    // Generate employee ID.
    if (this.$data.id == null) {
      this.$data.id = (await NymphServer.newUID('employee')) ?? undefined;
    }
    return await super.$save();
  }

  public static testStatic(value: number) {
    return value * 2;
  }

  public static throwErrorStatic() {
    throw new BadFunctionCallError('This function only throws errors.');
  }

  public $throwError() {
    throw new InvalidParametersError('This function only throws errors.');
  }

  public static inaccessibleMethod() {
    return true;
  }
}

NymphServer.setEntityClass(EmployeeModel.class, EmployeeModel);

export class BadFunctionCallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadFunctionCallError';
  }
}

export class Employee extends Entity<EmployeeData> {
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

  $throwError() {
    return this.$serverCall('throwError', []);
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

// The name of the server class
Employee.class = 'Employee';

Nymph.setEntityClass(Employee.class, Employee);
export default Employee;
