import { events } from "./events/index";

export let system:IVanillaServerSystem;

events.serverOpen.on(()=>{
    system = server.registerSystem(0, 0);
});
