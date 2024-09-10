import { BaseComponent, Components } from "@flamework/components";
import { AbstractConstructorRef } from "@flamework/components/out/utility";
import { Service, Controller, OnStart, Modding, Dependency } from "@flamework/core";
import Make from "@rbxts/make";
import { ReplicatedStorage, RunService, ServerStorage, Workspace } from "@rbxts/services";
import { Debug } from "decorators/debug";

@Service({})
@Controller({})
export class DebugService implements OnStart
{
    onStart(): void {
        Modding.onListenerAdded<typeof Debug>((object) =>
        {
            const decorator = Modding.getDecorator<typeof Debug>(object);
            if (decorator)

                this.visualize(object);

        })
    }

    visualize<T extends object>(component: T) 
    {
        const [paramsToDebug = [], whenConditional = (() => true)] = Modding.getDecorator<typeof Debug>(component)?.arguments ?? [];
        const instanceComponent = (component as BaseComponent);
        const scalarSize = 18;

        if (paramsToDebug)
        {
            print("Debug Instance:", instanceComponent.instance.Name)
            const getDebugParamText = (item: string) => `${item}: ${instanceComponent.attributes[item as never]}`;
            let Billboard: BillboardGui | undefined = Make("BillboardGui", {
                Name: "DebugGui",
                AlwaysOnTop: true,
                Children: paramsToDebug?.map((item, idx) => Make("TextLabel", {
                    Name: `DebugLabel:${item}`,
                    Text: `${item}: ${instanceComponent.attributes[item as never]}`,
                    TextColor3: new Color3(0,0,0),
                    TextScaled: true,
                    Position: UDim2.fromOffset(0, idx * scalarSize),
                    Size: new UDim2(1,0,0,scalarSize),
                    BackgroundColor3: new Color3(1,1,1),
                    BackgroundTransparency: 1,

                    Children: [
                        Make("UIStroke", {
                            ApplyStrokeMode: Enum.ApplyStrokeMode.Contextual,
                            Color: new Color3(1,1,1),
                        })
                    ],

                    TextXAlignment: Enum.TextXAlignment.Left,
                })),

                StudsOffset: new Vector3(0.25),
                StudsOffsetWorldSpace: new Vector3(0, -0.75, 0),
                Parent: Workspace.FindFirstChild("Debug") ?? Make("Folder", { Name: "Debug", Parent: Workspace}),
                Size: UDim2.fromOffset(128, (paramsToDebug?.size() ?? 1) * scalarSize)
            });


            instanceComponent.instance.AttributeChanged.Connect(() =>
            {
                if (whenConditional())
                {
                    for (const attributeName of paramsToDebug)
                    {
                        const billboardLabelAttribute = Billboard?.FindFirstChild(`DebugLabel:${attributeName}`) as TextLabel | undefined;
                        if (billboardLabelAttribute)
                        {
                            billboardLabelAttribute.Text = getDebugParamText(attributeName);
                        }
                        
                    }

                    if (Billboard)

                        Billboard.Adornee = (instanceComponent.instance.IsA("Model") && instanceComponent.instance.PrimaryPart ? instanceComponent.instance.PrimaryPart : instanceComponent.instance) as PVInstance;

                } else if (Billboard)

                    Billboard.Adornee = undefined;
            })
        }
    }
}
