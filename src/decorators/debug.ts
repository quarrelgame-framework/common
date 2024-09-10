import { BaseComponent } from "@flamework/components";
import { Modding, Reflect } from "@flamework/core";

/**
 * Request the required metadata for lifecycle events and dependency resolution.
 * @metadata flamework:implements flamework:parameters
 */
export const Debug = Modding.createDecorator<[AttributeNames: string[], When?: (() => boolean), Display?: ((key: string, component: BaseComponent) => string)]>("Class", (descriptor, [debugParams]) => {
    if ("onAttributeChanged" in descriptor.object)
    {
        Reflect.defineMetadata(descriptor.object, `qgf.debug`, debugParams)
    }
    else error(`decorator 'Debug' can only be applied to components`)
});

export default Debug;
