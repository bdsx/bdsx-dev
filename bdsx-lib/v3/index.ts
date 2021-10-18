
import eventsModule = require("./events");
import serverModule = require("./server");
import entityModule = require("./entity");
import playerModule = require("./player");
import commandModule = require("./command");

export namespace bdsx {
    export import Entity = entityModule.Entity;
    export import Player = playerModule.Player;
    export import events = eventsModule.events;
    export import server = serverModule.server;
    export import command = commandModule.command;
}
