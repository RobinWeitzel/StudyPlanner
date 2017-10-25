let moduleDict = {};
let moduleGroups = [];
let modulesSelected = [];
let p = 0;

const getIds = ([...modules]) => modules.map(m => m.Id);

function renderPDF(id, canvas, context) {

    let pages = moduleDict[id].modulePages;
    if (pages !== undefined) {
        if (p < 0) p = 0;
        if (p >= pages.length) p = pages.length - 1;
        let page = pages[p];

        let viewport = page.getViewport(1.4);

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        let renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        page.render(renderContext);
    } else {
        context.canvas.width = 600;
        context.font = "30px Arial";
        context.fillText("Modulhandbuch muss eingelesen werden,", 10, 50);
        context.fillText("damit PDF angezeigt werden kann.", 10, 100);
    }
}

function updateSum() {

    if(modulesSelected === undefined) {
        return false;
    }

    const addToMap = (map, key, val) => map.set(key, map.get(key) ? map.get(key) + val : val);

    const groupSum = (modules, condition) => {
        let result = new Map();
        modules.map(m=>addToMap(result, m.group, condition(m.mark) ? parseInt(m.Lp) : 0));
        return result;
    };

    const conditionSuccess = m => m !== "" && parseFloat(m) <= 4;
    const conditionPlanned = m => m === "" || parseFloat(m) <= 4;

    const getTotalSum = modules => modules.reduce((sum, elem) => sum + elem);

    const successMap = groupSum(modulesSelected, conditionSuccess);
    const plannedMap = groupSum(modulesSelected, conditionPlanned);
    
    const totalSumSuccess = getTotalSum(successMap.values());
    const totalSumPlanned = getTotalSum(plannedMap.values());

    return result = {
        successMap: new Map([...successMap.entries()].sort()),
        plannedMap: new Map([...plannedMap.entries()].sort()),
        successSum: totalSumSuccess,
        plannedSum: totalSumPlanned,
        successAvg: isNaN(totalSumSuccess / successMap.length) ? "" : totalSumSuccess / successMap.length
    }
}

function addModule(module) {
    
    module.name = moduleDict[moduleId].moduleName;
    module.lp = moduleDict[moduleId].moduleLp;

    if (!modulesSelected) {
        modulesSelected = [];
    }
     
    modulesSelected.push(module);  
    localStorage.setItem("modulesSelected", JSON.stringify(modulesSelected));
}

function loadPages(pageDict, truePages) {
    let id;
    let trueId;
    let pages;
    let rx = /[A-Z]+-[0-9]+/;
    for (let i = 0; i < Object.keys(pageDict).length; i++) {
        if (rx.test(pageDict[i].items[0].str)) {
            if (pageDict[i].items[0].str !== id) {
                if (id) {
                    trueId = rx.exec(id)[0];
                    moduleDict[trueId]["modulePages"] = pages;
                }

                id = pageDict[i].items[0].str;
                pages = [];
                pages.push(truePages[i]);
            } else {
                pages.push(truePages[i]);
            }
        }
    }
}

function parsePdf(pageDict) {
    let page1 = pageDict[0];
    let uni = page1.items[0].str + " " + page1.items[1].str;

    // Check if the PDF contains a Modulhandbuch from the university of Augsburg
    if (uni !== "Universität Augsburg Modulhandbuch") {
        waitingDialog.hide();
        alert("File could not be loaded");
        return;
    }

    let course;
    for (let j = 2; !page1.items[j].str.startsWith("Fakultät"); j++) {
        if (j === 2) {
            course = page1.items[2].str
        } else {
            course += page1.items[j].str;
        }
    }
    let faculty = page1.items[j].str;
    let semester = page1.items[j + 1].str;

    // Page to the table of contents
    let i = 1;
    while (pageDict[i].items[0].str !== "Inhaltsverzeichnis") {
        i++;
    }

    // Read first moduleGroup
    let moduleGroupHeight = pageDict[i].items[2].height;
    let moduleGroup = "";
    let moduleName = "";
    let moduleId;
    let moduleLp;
    let item;
    let rx = /^[A-Z]+-[0-9]+/;
    let rx2 = /(\.|\s|\+)+[0-9]+$/;
    let rx3 = /(?=(\([0-9]*\sECTS(\/|\s)+LP)).*$/;
    let rx4 = /\([0-9]*\sECTS/;
    for (j = 2; j < pageDict[i].items.length; j++) {
        item = pageDict[i].items[j];
        if (item.height === moduleGroupHeight) {
            if (pageDict[i].items[j - 1].height === moduleGroupHeight && j !== 2) {
                moduleGroup += " " + item.str;
            } else {
                moduleGroup = item.str;
                moduleName = "";
            }
        } else {
            if (rx.test(item.str)) {
                moduleName = item.str;
                moduleId = rx.exec(item.str)[0];

                if (rx2.test(moduleName)) {
                    moduleLp = rx4.exec(moduleName)[0];
                    moduleLp = moduleLp.substring(1, moduleLp.length - 5);
                    let module = {
                        moduleName: moduleName.replace(rx3.exec(moduleName)[0], ""),
                        moduleGroup: [moduleGroup],
                        moduleLp: moduleLp
                    }

                    if (moduleDict[moduleId] !== undefined) {
                        moduleDict[moduleId].moduleGroup.push(moduleGroup);
                    } else {
                        moduleDict[moduleId] = module;
                    }

                    moduleName = "";
                }
            } else {
                if (moduleName !== "") {
                    if (rx2.test(moduleName + " " + item.str)) {
                        //moduleName += item.str.replace(rx2.exec(item.str)[0], "");
                        moduleName += " " + item.str;
                        moduleLp = rx4.exec(moduleName)[0];
                        moduleLp = moduleLp.substring(1, moduleLp.length - 5);
                        let module = {
                            moduleName: moduleName.replace(rx3.exec(moduleName)[0], ""),
                            moduleGroup: [moduleGroup],
                            moduleLp: moduleLp
                        }

                        if (moduleDict[moduleId] !== undefined) {
                            moduleDict[moduleId].moduleGroup.push(moduleGroup);
                        } else {
                            moduleDict[moduleId] = module;
                        }

                        moduleName = "";
                    } else {
                        moduleName += " " + item.str;
                    }
                }
            }
        }
    }

    i++;

    // Continue reading the table of contents until the end is reached
    while (pageDict[i].items[0].str === "Inhaltsverzeichnis") {
        for (j = 1; j < pageDict[i].items.length; j++) {
            item = pageDict[i].items[j];
            if (item.height === moduleGroupHeight) {
                if (pageDict[i].items[j - 1].height === moduleGroupHeight && j !== 1) {
                    moduleGroup += " " + item.str;
                } else {
                    moduleGroup = item.str;
                    moduleName = "";
                }
            } else {
                if (rx.test(item.str)) {
                    moduleName = item.str;
                    moduleId = rx.exec(item.str)[0];

                    if (rx2.test(moduleName)) {
                        moduleLp = rx4.exec(moduleName)[0];
                        moduleLp = moduleLp.substring(1, moduleLp.length - 5);
                        let module = {
                            moduleName: moduleName.replace(rx3.exec(moduleName)[0], ""),
                            moduleGroup: [moduleGroup],
                            moduleLp: moduleLp
                        }

                        if (moduleDict[moduleId] !== undefined) {
                            moduleDict[moduleId].moduleGroup.push(moduleGroup);
                        } else {
                            moduleDict[moduleId] = module;
                        }

                        moduleName = "";
                    }
                } else {
                    if (moduleName !== "") {
                        if (rx2.test(moduleName + " " + item.str)) {
                            //moduleName += item.str.replace(rx2.exec(item.str)[0], "");
                            moduleName += " " + item.str;
                            moduleLp = rx4.exec(moduleName)[0];
                            moduleLp = moduleLp.substring(1, moduleLp.length - 5);
                            let module = {
                                moduleName: moduleName.replace(rx3.exec(moduleName)[0], ""),
                                moduleGroup: [moduleGroup],
                                moduleLp: moduleLp
                            }

                            if (moduleDict[moduleId] !== undefined) {
                                moduleDict[moduleId].moduleGroup.push(moduleGroup);
                            } else {
                                moduleDict[moduleId] = module;
                            }

                            moduleName = "";
                        } else {
                            moduleName += " " + item.str;
                        }
                    }
                }
            }
        }
        i++;
    }

    Object.keys(moduleDict).forEach(function (currentKey) {
        let mg = moduleDict[currentKey].moduleGroup;
        for (let i = 0; i < mg.length; i++) {
            if (moduleGroups.indexOf(mg[i]) < 0) {
                moduleGroups.push(mg[i]);
            }
        }
    });

    moduleGroups.sort();

    localStorage.setItem("moduleDict", JSON.stringify(moduleDict));

    localStorage.setItem("moduleGroups", JSON.stringify(moduleGroups));

    waitingDialog.hide();
}

function loadSave() {
    moduleDict = JSON.parse(localStorage.getItem("moduleDict"));
    moduleGroups = JSON.parse(localStorage.getItem("moduleGroups"));
    modulesSelected = JSON.parse(localStorage.getItem("modulesSelected"));

    if (modulesSelected) {
        for (let i = 0; i < modulesSelected.length; i++) {
            displayModule(modulesSelected[i]);
        }
    }

    updateSum();
 
    markModulesGreen();
}

let waitingDialog = waitingDialog || (function ($) {
    'use strict';

    // Creating modal dialog's DOM
    let $dialog = $(
        '<div class="modal fade" data-backdrop="static" data-keyboard="false" tabindex="-1" role="dialog" aria-hidden="true" style="padding-top:15%; overflow-y:visible;">' +
        '<div class="modal-dialog modal-m">' +
        '<div class="modal-content">' +
        '<div class="modal-header"><h3 style="margin:0;"></h3></div>' +
        '<div class="modal-body">' +
        '<div class="progress progress-striped active" style="margin-bottom:0;"><div class="progress-bar" style="width: 100%"></div></div>' +
        '</div>' +
        '</div></div></div>');

    return {
        /**
         * Opens our dialog
         * @param message Custom message
         * @param options Custom options:
         * 				  options.dialogSize - bootstrap postfix for dialog size, e.g. "sm", "m";
         * 				  options.progressType - bootstrap postfix for progress bar type, e.g. "success", "warning".
         */
        show: function (message, options) {
            // Assigning defaults
            if (typeof options === 'undefined') {
                options = {};
            }
            if (typeof message === 'undefined') {
                message = 'Loading';
            }
            let settings = $.extend({
                dialogSize: 'm',
                progressType: '',
                onHide: null // This callback runs after the dialog was hidden
            }, options);

            // Configuring dialog
            $dialog.find('.modal-dialog').attr('class', 'modal-dialog').addClass('modal-' + settings.dialogSize);
            $dialog.find('.progress-bar').attr('class', 'progress-bar');
            if (settings.progressType) {
                $dialog.find('.progress-bar').addClass('progress-bar-' + settings.progressType);
            }
            $dialog.find('h3').text(message);
            // Adding callbacks
            if (typeof settings.onHide === 'function') {
                $dialog.off('hidden.bs.modal').on('hidden.bs.modal', function (e) {
                    settings.onHide.call($dialog);
                });
            }
            // Opening dialog
            $dialog.modal();
        },
        /**
         * Closes dialog
         */
        hide: function () {
            $dialog.modal('hide');
        }
    };

})(jQuery);