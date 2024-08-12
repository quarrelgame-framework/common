declare class Visuals {
    constructor(color?: Color3);
    Hide(): void;

    Raycast(Origin: Vector3, Direction: Vector3, RaycastParameters?: RaycastParams): void;
    Blockcast(Origin: Vector3, Direction: Vector3, RaycastParameters?: RaycastParams): void;
    Spherecast(Origin: Vector3, Direction: Vector3, RaycastParameters?: RaycastParams): void;
}

export = Visuals;
