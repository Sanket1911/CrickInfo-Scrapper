// npm init -y
// npm install minimist
// npm install axios
// npm install jsdom
// npm install excel4node
// npm install pdf-lib

let minimist = require("minimist");
let axios = require("axios");
let jsdom = require("jsdom");
let excel4node = require("excel4node");
let pdf = require("pdf-lib");
let fs = require("fs");
let path = require("path");
// const { match } = require("assert");

// download html using axios
// extract information using jsdom
// convert matches to teams
// save teams to excel using excel4node
// create folder and save pdf using pdf-lib

// node crickInfoExtractor.js --excel=worldcup.xls --dataDir=worldcup --source=https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results


let args = minimist(process.argv);

let responsePromise = axios.get(args.source);
responsePromise.then(function(response){
    
    let html = response.data;

    let dom = new jsdom.JSDOM(html);
    let document = dom.window.document;

    let matchScoreDivs = document.querySelectorAll("div.match-score-block");
    let matches = [];

    for(let i=0;i<matchScoreDivs.length;i++){
        let match = {
            team1: "",
            team2: "",
            t1score: "",
            t2score: "",
            result: ""
        };
        let teamParas = matchScoreDivs[i].querySelectorAll("div.name-detail > p.name");
        match.team1 = teamParas[0].textContent;
        match.team2 = teamParas[1].textContent;

        let scoreSpans = matchScoreDivs[i].querySelectorAll("div.score-detail > span.score");
        if(scoreSpans.length == 2){
            match.t1score = scoreSpans[0].textContent;
            match.t2score = scoreSpans[1].textContent;
        }else if(scoreSpans.length == 1){
            match.t1score = scoreSpans[0].textContent;
            match.t2score = "";
        }else{
            match.t1score = "";
            match.t2score = "";
        }

        let resultSpan = matchScoreDivs[i].querySelector("div.status-text > span");
        match.result = resultSpan.textContent;
        matches.push(match);
    }

    // console.log(matches);    

    let matchesJSON = JSON.stringify(matches);
    fs.writeFileSync("matches.json",matchesJSON,"utf-8");
    
    let teams = [];
    // push team in teams, if not already there
    for(let i=0;i<matches.length;i++){
        pushTeamIntoTeams(teams,matches[i].team1);
        pushTeamIntoTeams(teams,matches[i].team2);    
    }
    // push match at appropriate place
    for(let i=0;i<matches.length;i++){
        pushMatchIntoTeams(teams,matches[i].team1,matches[i].team2,matches[i].t1score,matches[i].t2score,matches[i].result);
        pushMatchIntoTeams(teams,matches[i].team2,matches[i].team1,matches[i].t2score,matches[i].t1score,matches[i].result);
            
    }
    let teamsJSON = JSON.stringify(teams);
    fs.writeFileSync("teams.json",teamsJSON,"utf-8");

    prepareExcel(teams,args.excel);
    prepareFoldersAndPdfs(teams,args.dataDir);

})

function prepareFoldersAndPdfs(teams,dataDir){
    if(fs.existsSync(dataDir) == false){
        fs.mkdirSync(dataDir);
    }

    for(let i=0;i<teams.length;i++){
        let teamFolderName = path.join(dataDir,teams[i].name);
        if(fs.existsSync(teamFolderName) == false){
            fs.mkdirSync(teamFolderName);
        }

        for(let j=0;j<teams[i].matches.length;j++){
            let match = teams[i].matches[j];
            createMatchScorecardPdf(teamFolderName,teams[i].name,match);
        }
    }
}

function createMatchScorecardPdf(teamFolderName,homeTeam,match){
    let matchFileName = path.join(teamFolderName,match.vs + ".pdf");

    let templateFileBytes = fs.readFileSync("Template.pdf");
    let pdfdocPromise = pdf.PDFDocument.load(templateFileBytes);
    pdfdocPromise.then(function(pdfdoc){
        let page = pdfdoc.getPage(0);

        page.drawText(homeTeam,{
            x: 280,
            y: 430,
            size: 11
        });
        page.drawText(match.vs,{
            x: 280,
            y: 400,
            size: 11
        });
        page.drawText(match.selfScore,{
            x: 280,
            y: 370,
            size: 11
        });
        page.drawText(match.oppScore,{
            x: 280,
            y: 335,
            size: 11
        });
        page.drawText(match.result,{
            x: 280,
            y: 305,
            size: 11
        });

        let changedBytesPromise = pdfdoc.save();
        changedBytesPromise.then(function(changedBytes){
            fs.writeFileSync(matchFileName,changedBytes);
        })

    })
}

function prepareExcel(teams,excelFileName){
    let wb = new excel4node.Workbook();

    for(let i=0;i<teams.length;i++){
        let tsheet = wb.addWorksheet(teams[i].name);

        tsheet.cell(1,1).string("Vs");
        tsheet.cell(1,2).string("Self Score");
        tsheet.cell(1,3).string("Opp Score");
        tsheet.cell(1,4).string("Result");

        for(let j=0;j<teams[i].matches.length;j++){
            tsheet.cell(2+j,1).string(teams[i].matches[j].vs);
            tsheet.cell(2+j,2).string(teams[i].matches[j].selfScore);
            tsheet.cell(2+j,3).string(teams[i].matches[j].oppScore);
            tsheet.cell(2+j,4).string(teams[i].matches[j].result);
        }
        
    }

    wb.write(excelFileName);
}

function pushMatchIntoTeams(teams,homeTeam,oppTeam,homeScore,oppScore,result){
    let t1idx = -1;
    for(let j=0;j<teams.length;j++){
        if(teams[j].name == homeTeam){
            t1idx = j;
        }
    }
    let team = teams[t1idx];
    team.matches.push({
        vs: oppTeam,
        selfScore: homeScore,
        oppScore: oppScore,
        result: result
    })
}

function pushTeamIntoTeams(teams,teamName){
    let t1idx = -1;
    for(let j=0;j<teams.length;j++){
        if(teams[j].name == teamName){
            t1idx = j;
            break;
        }
    }
    if(t1idx == -1){
        let team = {
            name: teamName,
            matches : []
        }
        teams.push(team);
    }
}