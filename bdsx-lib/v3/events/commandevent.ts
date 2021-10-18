import { events } from ".";
import { hook } from "../../hook";
import { CommandContext, MCRESULT, MinecraftCommands } from "../../minecraft";
import { _tickCallback } from "../../util";
import { command } from "../command";

export class CommandEvent {
    constructor(
        public command:string,
        public readonly origin:command.Origin,

        private readonly context:CommandContext,
    ) {
    }

    /**
     * @deprecated compatibility warning. it returns the native class of Bedrock Dedicated Server. it can be modified by updates.
     */
    getRawContext():CommandContext {
        return this.context;
    }
}

events.command.setInstaller(()=>{
    const executeCommandOriginal = hook(MinecraftCommands, 'executeCommand').call(function(ctxptr, mute):MCRESULT {
        try {
            const ctx = ctxptr.p!;
            const ev = new CommandEvent(ctx.command, new command.Origin(ctx.origin), ctx);
            const resv = events.command.fire(ev);
            switch (typeof resv) {
            case 'number':
                _tickCallback();
                return MCRESULT.create(resv);
            default:
                _tickCallback();
                ctx.command = ev.command;
                return executeCommandOriginal.call(this, ctxptr, mute);
            }
        } catch (err) {
            events.errorFire(err);
            return MCRESULT.create(-1);
        }
    });
});
