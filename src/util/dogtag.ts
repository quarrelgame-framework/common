import type { Entity } from "components/entity.component";

class Dogtag
{
    private entityId: string;

    constructor({ attributes }: Entity)
    {
        this.entityId = attributes.EntityId;
    }

    public idk()
    {
    }
}
