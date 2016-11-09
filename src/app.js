/// <reference path="../thirdparty/phaser.d.ts" />
var SCREEN_WIDTH = 1024;
var SCREEN_HEIGHT = 768;
var WATER_Y = 480;
var PLANE_SPEED = 6;
// const LEVEL = {
// 	max_plane_tank: 4,
// 	max_island_tank: 4,
// 	plane: {island: 0, tank_fill: 2},
// 	islands: [
// 		{ x: 0, tank_fill: 2, },
// 		{ x: 4, tank_fill: 0, },
// 	],
// }
// const LEVEL = {
// 	max_plane_tank: 4,
// 	max_island_tank: 4,
// 	plane: {island: 0, tank_fill: 4},
// 	islands: [
// 		{ x: 0, tank_fill: 3, },
// 		{ x: 1, tank_fill: 0, },
// 		{ x: 5, tank_fill: 0, },
// 	],
// }
var LEVEL = {
    max_plane_tank: 4,
    max_island_tank: 8,
    plane: { island: 0, tank_fill: 4 },
    islands: [
        { x: 0, tank_fill: 8 },
        { x: 1, tank_fill: 0 },
        { x: 2, tank_fill: 0 },
        { x: 6, tank_fill: 0 },
    ]
};
// const LEVEL = {
// 	max_plane_tank: 4,
// 	max_island_tank: 20,
// 	plane: {island: 0, tank_fill: 4},
// 	islands: [
// 		{ x: 0, tank_fill: 19, },
// 		{ x: 1, tank_fill:  0, },
// 		{ x: 2, tank_fill:  0, },
// 		{ x: 3, tank_fill:  0, },
// 		{ x: 7, tank_fill:  0, },
// 	],
// }
// const LEVEL = {
// 	max_plane_tank: 5,
// 	max_island_tank: 20,
// 	plane: {island: 0, tank_fill: 5},
// 	islands: [
// 		{ x: 0, tank_fill: 18, },
// 		{ x: 1, tank_fill:  0, },
// 		{ x: 3, tank_fill:  0, },
// 		{ x: 7, tank_fill:  0, },
// 	],
// }
function remapClamp(x, in_min, in_max, out_min, out_max) {
    if (x <= in_min) {
        return out_min;
    }
    if (x >= in_max) {
        return out_max;
    }
    return out_min + (x - in_min) * (out_max - out_min) / (in_max - in_min);
}
function lerp(t, a, b) {
    return (1 - t) * a + t * b;
}
function clone(o) {
    return JSON.parse(JSON.stringify(o));
}
var Tank = (function () {
    function Tank() {
    }
    return Tank;
}());
function create_tank(x, y, parent) {
    var tank = new Tank();
    tank.empty = game.add.sprite(x, y, 'tank_empty');
    tank.full = game.add.button(x, y, 'tank_full');
    tank.empty.anchor.x = tank.empty.anchor.y = 0.5;
    tank.full.anchor.x = tank.full.anchor.y = 0.5;
    parent.addChild(tank.empty);
    parent.addChild(tank.full);
    return tank;
}
function update_tank(tank, fullness) {
    tank.empty.alpha = 1 - fullness;
    tank.full.alpha = fullness;
}
var Island = (function () {
    function Island() {
        this.sprite = null;
        this.tank_fill = 0;
        this.tanks = [];
    }
    return Island;
}());
var Flight = (function () {
    function Flight() {
    }
    return Flight;
}());
var Plane = (function () {
    function Plane() {
        this.sprite = null;
        this.tank_fill = 0;
        this.tanks = [];
        this.flight = null; // Null when not flying
        this.island = null;
    }
    return Plane;
}());
var App = (function () {
    function App() {
        this.undo_button = null;
        this.islands = [];
        this.level_state = clone(LEVEL);
        this.undo_stack = [];
    }
    App.prototype.preload = function () {
        game.load.image('goal', 'data/gfx/goal.png');
        game.load.image('island', 'data/gfx/island.png');
        game.load.image('ocean', 'data/gfx/ocean.jpg');
        game.load.image('plane', 'data/gfx/plane.png');
        game.load.image('tank_empty', 'data/gfx/tank_empty.png');
        game.load.image('tank_full', 'data/gfx/tank_full.png');
        game.load.image('undo', 'data/gfx/undo.png');
    };
    App.prototype.create_island = function (island_index, xype, max_tanks) {
        var _this = this;
        var island = new Island();
        island.sprite = game.add.button(0, WATER_Y, 'island');
        island.sprite.anchor.x = island.sprite.anchor.y = 0.5;
        var on_click_island = function () { _this.on_click_island(island); };
        island.sprite.onInputDown.add(on_click_island);
        for (var i = 0; i < max_tanks; ++i) {
            var x = (i % 6 - 2.5) * 16;
            var y = 80 + 24 * Math.floor(i / 6);
            var tank = create_tank(x, y, island.sprite);
            island.tanks.push(tank);
            tank.full.onInputDown.add(on_click_island);
        }
        return island;
    };
    App.prototype.create_plane = function () {
        var _this = this;
        var max_plane_tank = this.level_state.max_plane_tank;
        var plane = new Plane();
        plane.tank_fill = max_plane_tank;
        plane.sprite = game.add.button(0, WATER_Y, 'plane');
        plane.sprite.anchor.x = 0.5;
        plane.sprite.anchor.y = 0.85;
        var on_click_plane = function () { _this.on_click_plane(); };
        plane.sprite.onInputDown.add(on_click_plane);
        for (var i = 0; i < max_plane_tank; ++i) {
            var x = (i - 1.5) * 16;
            var y = -56;
            var tank = create_tank(x, y, plane.sprite);
            plane.tanks.push(tank);
            tank.full.onInputDown.add(on_click_plane);
        }
        return plane;
    };
    App.prototype.create = function () {
        var _this = this;
        game.world.setBounds(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        game.add.sprite(0, 0, 'ocean');
        this.undo_button = game.add.button(32, 32, 'undo');
        this.undo_button.onInputDown.add(function () { _this.on_undo(); });
        var max_dist = this.level_state.islands[this.level_state.islands.length - 1].x;
        this.pixels_per_tank = (SCREEN_WIDTH - 128) / max_dist;
        var left = (SCREEN_WIDTH - (max_dist * this.pixels_per_tank)) / 2;
        this.level_state.islands.forEach(function (island_state, island_index) {
            var max_tanks = (island_index == _this.level_state.islands.length - 1 ? 0 : _this.level_state.max_island_tank);
            var island = _this.create_island(island_index, 'island_source', max_tanks);
            island.sprite.x = left + island_state.x * _this.pixels_per_tank;
            _this.islands.push(island);
        });
        var goal_island = this.islands[this.islands.length - 1];
        var goal_flag = game.add.sprite(0, -100, 'goal');
        goal_flag.anchor.x = goal_flag.anchor.y = 0.5;
        goal_island.sprite.addChild(goal_flag);
        this.plane = this.create_plane();
        this.apply_state(this.level_state);
    };
    App.prototype.update = function () {
        var plane = this.plane;
        if (plane.flight) {
            var flight = plane.flight;
            var diff_tank = PLANE_SPEED / this.pixels_per_tank;
            if (plane.tank_fill < -0.05) {
                plane.sprite.y += PLANE_SPEED;
            }
            else {
                var dir = (flight.to.sprite.x > flight.from.sprite.x ? 1 : -1);
                var dist_from_source = Math.abs(flight.from.sprite.x - plane.sprite.x);
                var dist_from_target = Math.abs(flight.to.sprite.x - plane.sprite.x);
                var dist_from_airport = Math.min(dist_from_source, dist_from_target);
                plane.sprite.x += dir * PLANE_SPEED;
                plane.sprite.y = WATER_Y - remapClamp(dist_from_airport, 0, 100, 0, 64);
                plane.tank_fill -= diff_tank;
                if (dir * plane.sprite.x > dir * flight.to.sprite.x) {
                    plane.island = flight.to;
                    plane.flight = null;
                    plane.tank_fill = Math.round(plane.tank_fill);
                }
            }
        }
        plane.tanks.forEach(function (tank, i) {
            update_tank(tank, remapClamp(plane.tank_fill, i, i + 1, 0, 1));
        });
        var _loop_1 = function(island) {
            island.tanks.forEach(function (tank, i) {
                update_tank(tank, remapClamp(island.tank_fill, i, i + 1, 0, 1));
            });
        };
        for (var _i = 0, _a = this.islands; _i < _a.length; _i++) {
            var island = _a[_i];
            _loop_1(island);
        }
        this.undo_button.alpha = this.undo_stack.length == 0 ? 0 : 1;
    };
    App.prototype.render = function () {
    };
    App.prototype.send_tank_from_plane_to_island = function (plane) {
        console.assert(plane.island != null);
        if (plane.tank_fill > 0 && plane.island.tank_fill < this.level_state.max_island_tank) {
            plane.tank_fill -= 1;
            plane.island.tank_fill += 1;
        }
    };
    App.prototype.send_tank_from_island_to_plane = function (plane) {
        console.assert(plane.island != null);
        if (plane.tank_fill < this.level_state.max_plane_tank && plane.island.tank_fill > 0) {
            plane.tank_fill += 1;
            plane.island.tank_fill -= 1;
        }
    };
    App.prototype.on_click_island = function (clicked_island) {
        console.assert(clicked_island != null);
        console.log("Island clicked");
        var plane = this.plane;
        if (plane.flight) {
            return;
        }
        if (plane.island == clicked_island) {
            var island = plane.island;
            this.send_tank_from_island_to_plane(plane);
        }
        else {
            console.assert(plane.island != null);
            if (plane.tank_fill > 0) {
                this.create_undo_point();
                var flight = new Flight();
                flight.from = plane.island;
                flight.to = clicked_island;
                plane.flight = flight;
                plane.island = null;
            }
        }
    };
    App.prototype.on_click_plane = function () {
        console.log("Plane clicked");
        var plane = this.plane;
        if (plane.flight) {
            return;
        }
        var island = plane.island;
        console.assert(island != null);
        this.send_tank_from_plane_to_island(plane);
    };
    App.prototype.on_undo = function () {
        if (this.undo_stack.length == 0) {
            return;
        }
        var state = this.undo_stack.pop();
        this.apply_state(state);
    };
    App.prototype.create_undo_point = function () {
        var state = clone(this.level_state);
        for (var i = 0; i < this.islands.length; ++i) {
            state.islands[i].tank_fill = this.islands[i].tank_fill;
        }
        console.assert(this.plane.flight == null);
        console.assert(this.plane.island != null);
        state.plane.island = this.islands.indexOf(this.plane.island);
        state.plane.tank_fill = this.plane.tank_fill;
        this.undo_stack.push(state);
    };
    App.prototype.apply_state = function (state) {
        for (var i = 0; i < this.islands.length; ++i) {
            this.islands[i].tank_fill = state.islands[i].tank_fill;
        }
        this.plane.flight = null;
        this.plane.island = this.islands[state.plane.island];
        this.plane.sprite.x = this.plane.island.sprite.x;
        this.plane.sprite.y = this.plane.island.sprite.y;
        this.plane.tank_fill = state.plane.tank_fill;
    };
    return App;
}());
var app = new App();
var game = new Phaser.Game(SCREEN_WIDTH, SCREEN_HEIGHT, Phaser.CANVAS, "plane_planning", app);
/*
this.game.canvas.width *= window.devicePixelRatio;
this.game.canvas.height *= window.devicePixelRatio;
this.game.canvas.style.width = SCREEN_WIDTH + 'px'
this.game.canvas.style.height = SCREEN_HEIGHT + 'px';
this.game.canvas.getContext('2d').scale(window.devicePixelRatio, window.devicePixelRatio);
*/
