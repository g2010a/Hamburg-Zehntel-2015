/* global moment */
/* global Miso */
/// <reference path="../typings/jquery/jquery.d.ts"/>
/// <reference path="../typings/lodash/lodash.d.ts"/>
/// <reference path="../typings/d3/d3.d.ts"/>
  
/*
 * Simulation class
 * Simulates the marathon with dots moving along a line
 * Inputs: 
 *  options.ds_full required A Miso dataset
 *  options.target required A reference to a DOM object that will contain the animation
 * Functions: 
 *  reset()
 *  start()
 *  stop()
 *  highlight(list_of_runners)
 */
var Simulation = function (options) {
    if (!options.data || !options.target || !options.orgs) {
        console.log("Data, target and orgs are required");
        return false;
    } 
    
    this.ds_full = options.data;
    this.target = options.target;
    this.orgs = options.orgs;
    this.max_runners_displayed = options.max_runners_displayed || 500;  // Too many runners crash slow browsers
    this.top_bottom_retained = options.top_bottom_retained || 5;        // Number of top/bottom runners to ALWAYS display
    this.radius = options.radius || 2;                                  // The radius of the circles representing runners
    this.duration = options.duration || 50000;                          // Animation length
    
    this._ds = {};
    this._status = "stopped";
    this._max_runtime = null;
    this._dom_runners = [];
    this._highlighted = null;
    this._jTarget = $(this.target);
    this._dTarget = d3.select(this.target);
    this._margin = {top: this.radius , right: this.radius + 60, bottom: this.radius, left: this.radius};
    this._height = this._jTarget.height() - this._margin.top - this._margin.bottom;
    this._width = this._jTarget.width() - this._margin.left - this._margin.right;
    this._min_max_rank = this.ds_full.max("rank") - this.top_bottom_retained;
    this._y = d3.scale.linear().domain([0, 100]).range([this._height, 0]);
    this._x = d3.scale.linear().domain([0, 1]).range([0, this._width]);
    this._t = null;
    
    this._svg = this._dTarget.select("svg")[0][0] ?
          this._dTarget.select("svg") :
          this._dTarget.append("svg")
            .attr("width", this._width + this._margin.left + this._margin.right)
            .attr("height", this._height + this._margin.top + this._margin.bottom)
            .append("g")
            .attr("transform", "translate(" + this._margin.left + "," + this._margin.top + ")");

    // Initialize data
    this.reset();
};

//
// Reset animation
// 
Simulation.prototype.reset = function(){
    // Choose a subset of runners to display so as to not bog down the browser with thousands
    var self = this;
    
    // Build array of highlighted runners
    self._highlighted_ids = []; 
    if (self._highlighted) {
        if (self._highlighted.runners) self._highlighted_ids = _.union(self._highlighted_ids, self._highlighted.runners);
        if (self._highlighted.orgs) {
            _.each(self._highlighted.orgs, function(org_id){
                _.some(self.orgs, function(org){
                    if (org._id == org_id) {
                        self._highlighted_ids = _.union(org._oids, self._highlighted_ids);
                        return true;
                    } 
                    return false;
                });
            });
        }
    }
console.log(this);    
    // Choose runners to display
    var chances_runner_is_displayed = self.max_runners_displayed / (self.ds_full.length - 2 * self.top_bottom_retained - self._highlighted_ids.length);
    self._ds = self.ds_full.where({
        rows: function(row) {
            if (row.rank < self.top_bottom_retained || row.rank >  self._min_max_rank) return true;    // Always display top/bottom runners
            if (_.contains(self._highlighted_ids, row._id)) return true;
            return Math.random() <= chances_runner_is_displayed;
        }
    });

    self._max_runtime = self._ds.max("tot_time");
    self._t = d3.scale.linear().domain([0, self._max_runtime.asMinutes()]).range([0, self.duration]);
    
    // Runners
    self._svg.selectAll(".runner").remove();
    self._dom_runners = self._svg.selectAll(".runner").data(self._ds.toJSON());
    self._dom_runners.enter().append("circle")
        .attr("cy", function(){ return self._y(Math.round(Math.random()*100));})
        .attr("cx", 0)
        .attr("r", self.radius)
        .attr("data-id", function(d){ return d._id; })
        .attr("title", function(d){ return d.name; })
        .attr("class", function(d){ 
                var str = d.gndr == "F" ? "runner girl" : "runner boy";
                if (_.contains(self._highlighted_ids, d._id)) str += " highlighted";  
                return str;
        });
    self._dom_runners.exit().remove();
    
    // Timer
    if (!self._timer) self._timer = self._svg.append("text")
                                        .attr("dy", ".75em")
                                        .attr("y", this._jTarget.height() - self._margin.bottom - 14)
                                        .attr("x", this._jTarget.width() - self._margin.left - 2)
                                        .attr("text-anchor", "end");
    self._timer.text("0 mins");
    self._status = "stopped";
}; // this.reset

//
// Start animation
//
Simulation.prototype.start = function() {
    var self = this;
    self._dom_runners.transition()
        .attr("cx", self._x(1))
        .ease("linear")
        .delay(function(d){
            return self._t(d.tot_time.asMinutes() - d.net_time.asMinutes());
        })
        .duration(function(d){ 
            return self._t(d.net_time.asMinutes());
        });
    
    self._timer.transition()
        .duration(self._t(self._max_runtime.asMinutes()))
        .ease("linear")
        .tween("text", function(){
            var i8r = d3.interpolateRound(0, self._max_runtime.asMinutes());
            return function(t) {
                this.textContent = i8r(t) + " mins";
            };
        });
    self._status = "playing";
}; // this.start
//
// Pause animation
//
Simulation.prototype.pause = function() {
    // Unpause is not implemented!
    var self = this;
    self._dom_runners.transition().duration(0);
    self._timer.transition().duration(0);
    // self._status = "paused";
};
Simulation.prototype.get_displayed = function() { var self = this; return self._ds; };
Simulation.prototype.get_status = function(){ var self = this; return self._status; };
Simulation.prototype.set_highlighted = function(v){ var self = this; self._highlighted = v; self.reset(); return true };

$(function(){
    console.log("Initializing application...");
    // GLOBALS
    var persistent = {          // Shared variables
            orgs: [],           // Count of orgs for 2015: [ {org: "...", count: ..., _oids:[...], _id: ... } , ...]
            highlighted: {
                orgs: [],
                runners: []
            }
        },
        status = $("#info");
    var sim;
    
console.log("Persistent: ", persistent);   
           
    // UI
    $("select").select2();
    $("#input_organization").on("select2:select", __updateAll);
    $("#input_organization").on("select2:unselect", __updateAll);
    $("#input_runner").on("select2:select", __updateAll);
    $("#input_runner").on("select2:unselect", __updateAll);
    function __updateAll(evt){
        var data = evt.params.data || {},
            isAdd = data.selected,
            collection;
            
console.log("Event! ", data, evt);
        
        // Determine the collection to affect
        if (evt.currentTarget.id == "input_organization") collection = persistent.highlighted.orgs;
        else if (evt.currentTarget.id == "input_runner") collection = persistent.highlighted.runners;
        
        // Add/remove from collection
        if (isAdd) { if (!_.contains[collection, data.id*1]) collection.push(data.id*1); }
        else { 
            collection = _.without(collection, data.id*1);
            if (evt.currentTarget.id == "input_organization") persistent.highlighted.orgs = collection;
            else if (evt.currentTarget.id == "input_runner") persistent.highlighted.runners = collection;
        }
        
        // Refresh views
        sim && sim.set_highlighted(persistent.highlighted);
    }

    
    // Retrieve data from files
    status.html("Loading data...");
    $.getJSON("data/data_cols.json")
        .done(toDataset)
        .fail(function(error){
            status.html("Failed to retrieve data!");
        });
        
        
    // Process data using Miso
    function toDataset(raw_data) {
        //console.log("Data retrieved. Initializing Miso dataset...", raw_data);
        status.html("Loading data into Miso dataset...");
        var ds = new Miso.Dataset({
            data: raw_data,
            importer: Miso.Dataset.Importers.local,
            parser : Miso.Dataset.Parsers.ColumnParser
        });
        ds.fetch({ 
            success: analyze, 
            error: function(e){ status.html("Error loading data into dataset"); console.log("Error: ", e);}
        }); 
    }
    
    /*
     * Use dataset for charts and interaction
     */
    function analyze() {
        var ds = this,
            ds_2015 = ds.where({rows: function(row){ return row.yr == 2015; }});
// console.log("Dataset: ", ds, " Cols: " + ds.columnNames());
        status.html("Populating inputs...");
        
        // Populate orgs input
        persistent.orgs = ds_2015.countBy("org")
            .sort(function(a,b){ return a.org.localeCompare(b.org, "de"); })
            .toJSON();
        var tmp_formatted = [{ id: -1, text: "" }];
        persistent.orgs.forEach(function(v,i){ 
            tmp_formatted.push({id: v._id, text: (v.org || "[No org]") + " ( " + v.count + " runners)" });
        });
        $("#input_organization").select2({ data: tmp_formatted });
            
        // Populate runners input
        var tmp_runners = [{ id: -1, text: "" }];
        ds_2015.sort(function(a,b){ return a.name.localeCompare(b.name, "de"); })
            .toJSON().forEach(function(v,i){
                tmp_runners.push({ id: v._id, text: v.name });
            });
        $("#input_runner").select2({ data: tmp_runners });
           
        // Actions
        $("#stop_simulation").on("click", function(){
            if (!sim) return;
            sim.reset();
            $("[data-d-sim-runners]").html(sim.get_displayed().length + "/" + ds_2015.length);
        });
        $("#playpause_simulation").on("click", function(){
            if (!sim) return;
            var status = sim.get_status();
            if (status !== "playing") {
                sim.start();
            } else {
                sim.pause();
            }
        });
         
       // Charts
        sim = new Simulation({ target: "#simulation", data: ds_2015, orgs: persistent.orgs, max_runners_displayed: 1100 });

        _age_histogram(ds_2015);
    }
    
    /* 
     * Age histogram
     */
    function _age_histogram(ds){
        status.html("Calculating age histogram...");
        var jcontainer = $("#age_histogram"),
            margin = {top: 10, right: 30, bottom: 30, left: 30},
            width = jcontainer.width() - margin.left - margin.right,
            height = jcontainer.height() - margin.top - margin.bottom,
            min_age = ds.min("age"),
            max_age = ds.max("age"),
            bins = (function(min, max) { var ret=[]; for(var i=min; i<=max; i++) {ret.push(i); }; return ret;})(min_age, max_age); // Array of single ages, for bins
        
        var formatCount = d3.format(",.0f");

        // Split data by gender
        var data_boys = ds.where({rows: function(row){ return row.gndr == "M"; }}).toJSON(),
            data_girls = ds.where({rows: function(row){ return row.gndr == "F"; }}).toJSON();
        var hist_boys = d3.layout.histogram()
                .bins(bins)
                .value(function(d){ return d.age;})
                (data_boys),
            hist_girls = d3.layout.histogram()
                .bins(bins)
                .value(function(d){ return d.age;})
                (data_girls);      
                        
        // Scales
        var hist_max = d3.max($.merge($.merge([], hist_girls), hist_boys), function(d){ return d.y; });
        var y = d3.scale.linear()
            .domain([0, hist_max])
            .range([height, 0]);
        var x = d3.scale.linear()
            .domain([min_age, max_age])
            .range([0, width]);
        
        // Chart 
        var svg = d3.select("#age_histogram").append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                .append("g")
                    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");                
        _render(hist_boys, "boys");
        _render(hist_girls, "girls");
        
        // X Axis
        var xAxis = d3.svg.axis()
            .scale(x)
            .orient("bottom");
        svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")")
            .call(xAxis);
            
        function _render(hist, css_class) {
            //
            // Renders a histogram
            //
            var group = svg.append("g").attr("class", css_class);
            var bar = group.selectAll(".bar")
                .data(hist)
                .enter().append("g")
                    .attr("class", "bar")
                    .attr("transform", function(d){ return "translate(" + x(d.x) + "," + y(d.y) + ")"; });
            bar.append("rect")
                .attr("x", 1)
                .attr("width", x(min_age+1) - 1)
                .attr("height", function(d) { return height - y(d.y); });
            bar.append("text")
                .attr("dy", ".75em")
                .attr("y", 6)
                .attr("x", x(min_age+1) / 2)
                .attr("text-anchor", "middle")
                .text(function(d){ return formatCount(d.y); })
        }
    }
    
    
    /*
     * Run time histogram
     */
/*
    function runtime_histogram(all_data){
        // Add runtime duration to data array
        $.each(all_data, function(i,v){ 
            v.duration = moment.duration(v["Net run time"]);
            v.runtime_minutes = v.duration.asMinutes();
        });
        var jcontainer = $("#runtime_histogram"),
            margin = {top: 10, right: 30, bottom: 30, left: 30},
            width = jcontainer.width() - margin.left - margin.right,
            y_axis_label_width = 15,
            hist_width = (width - y_axis_label_width)/2,    // The histograms are placed next to each other
            height = jcontainer.height() - margin.top - margin.bottom,
            min_runtime = d3.min(all_data, function(d){return d.runtime_minutes; }),
            max_runtime = d3.max(all_data, function(d){return d.runtime_minutes; }),
            bins = (function(min, max) {var ret=[]; for(var i=min; i<=max; i++) {ret.push(i);}; return ret;})(Math.floor(min_runtime), Math.ceil(max_runtime)); // Array of single ages, for bins
     
        var formatCount = d3.format(",.0f");
        
        // Split data by gender
        var data_boys = all_data.filter(function(d){ return d["Gender"] == "M"; }),
            data_girls = all_data.filter(function(d){ return d["Gender"] == "F"; });
        var hist_boys = d3.layout.histogram()
                .bins(bins)
                .value(function(d){ return d.runtime_minutes;})
                (data_boys),
            hist_girls = d3.layout.histogram()
                .bins(bins)
                .value(function(d){ return d.runtime_minutes;})
                (data_girls);      
                        
        // Scales
        var hist_max = d3.max($.merge($.merge([], hist_girls), hist_boys), function(d){ return d.y; });
        var x = d3.scale.linear()
            .domain([0, hist_max])
            .range([0, hist_width]);
        var y = d3.scale.linear()
            .domain([min_runtime, max_runtime])
            .range([height, 0]);
        
        // Chart 
        var svg = d3.select("#age_histogram").append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                .append("g")
                    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");                
        _render(hist_boys, "boys");
        _render(hist_girls, "girls");
        
        // X Axis
        var yAxis = d3.svg.axis()
            .scale(y)
            .orient("middle");
        svg.append("g")
            .attr("class", "y axis")
            .attr("transform", "translate(" + hist_width + ", 0)")
            .call(yAxis);
            
        function _render(hist, css_class) {
            //
            // Renders a histogram
            //
            var group = svg.append("g").attr("class", css_class);
            var bar = group.selectAll(".bar")
                .data(hist)
                .enter().append("g")
                    .attr("class", "bar")
                    .attr("transform", function(d){ return "translate(" + x(d.x) + "," + y(d.y) + ")"; });
            bar.append("rect")
                .attr("x", 1)
                .attr("width", x(min_age+1) - 1)
                .attr("height", function(d) { return height - y(d.y); });
            bar.append("text")
                .attr("dy", ".75em")
                .attr("y", 6)
                .attr("x", x(min_age+1) / 2)
                .attr("text-anchor", "middle")
                .text(function(d){ return formatCount(d.y); })
        }
    }
*/
});

/*
 * Custom parser for Miso
 */
Miso.Dataset.Parsers.ColumnParser = function(data, options) {};
_.extend(
    Miso.Dataset.Parsers.ColumnParser.prototype,
    Miso.Dataset.Parsers.prototype,
    {
        parse : function(data) {
            var obj = {
                    columns : _.keys(data),
                    data : data
                };
            return obj;
        }
    }
);
/* 
 * Custom "duration" Miso type
 */
Miso.Dataset.types.duration = {
    name: "duration",
    regexp: /^\d\d\:\d\d\:\d\d(\.\d+)?$/,
    test: function(v) {
        return this.regexp.test(v);
    },
    coerce: function(v) {
        return moment.duration(v);
    },
    compare: function(a,b){
        return a > b ? 1 : (a < b ? -1 : 0);
    },
    numeric: function(v){
        return v.asMilliseconds();
    }
};