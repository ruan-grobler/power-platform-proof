/*
*This is auto generated from the ControlManifest.Input.xml file
*/

// Define IInputs and IOutputs Type. They should match with ControlManifest.
export interface IInputs {
    dueDate: ComponentFramework.PropertyTypes.DateTimeProperty;
    warningHours: ComponentFramework.PropertyTypes.WholeNumberProperty;
    criticalHours: ComponentFramework.PropertyTypes.WholeNumberProperty;
    label: ComponentFramework.PropertyTypes.StringProperty;
}
export interface IOutputs {
    dueDate?: Date;
}
