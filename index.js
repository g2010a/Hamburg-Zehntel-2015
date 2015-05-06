/// <reference path="typings/jquery/jquery.d.ts"/>
/// <reference path="typings/d3/d3.d.ts"/>
$(function(){
    console.log("initializing...");
    $.getJSON("2015_das_zehntel.json")
        .done(function(data){
            console.log("... data loaded", data);
            age_histogram(data);
            runtime_histogram(data); 
        })
        .fail(function(error){
            alert("Failed to retrieve data!");
        });
        
    /* 
     * Age histogram
     */
    function age_histogram(all_data){
        var jcontainer = $("#age_histogram"),
            margin = {top: 10, right: 30, bottom: 30, left: 30},
            width = jcontainer.width() - margin.left - margin.right,
            height = jcontainer.height() - margin.top - margin.bottom,
            min_age = d3.min(all_data, function(d){return d["Age group"];}),
            max_age = d3.max(all_data, function(d){return d["Age group"];}),
            bins = (function(min, max) { var ret=[]; for(var i=min; i<=max; i++) {ret.push(i); }; return ret;})(min_age, max_age); // Array of single ages, for bins
        
        var formatCount = d3.format(",.0f");

        // Split data by gender
        var data_boys = all_data.filter(function(d){ return d["Gender"] == "M"; }),
            data_girls = all_data.filter(function(d){ return d["Gender"] == "F"; });
        var hist_boys = d3.layout.histogram()
                .bins(bins)
                .value(function(d){ return d["Age group"]})
                (data_boys),
            hist_girls = d3.layout.histogram()
                .bins(bins)
                .value(function(d){ return d["Age group"]})
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
});