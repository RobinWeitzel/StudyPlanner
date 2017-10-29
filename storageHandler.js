(function() {
    function init() {
        // Enable change events for changes in the same browser window
        RemoteStorage.config.changeEvents.window = true;

        // Claim read/write access for the ["study-planner"] category
        remoteStorage.access.claim('study-planner', 'rw');

        // Display the RS connect widget
        remoteStorage.displayWidget();

        remoteStorage["study-planner"].init();

        remoteStorage["study-planner"].on('change', function(event) {
            if(event.newValue && (! event.oldValue)) {
                console.log('Change from '+event.origin+' (add)', event);
                displayModule(event.newValue);
            }
            else if((! event.newValue) && event.oldValue) {
                console.log('Change from '+event.origin+' (remove)', event);
                hideModule(event.relativePath);
            }
            else if(event.newValue && event.oldValue) {
                console.log('Change from '+event.origin+' (change)', event);
                // TODO update module
            }
        });

        remoteStorage.on('ready', function() {
            transferToRemote();
            $(document).on('click', '.addButton', function(event) {
                addModule();   
            });

            $(document).on('click', '.deleteButton', function () {
                var id = $(this).parents('tr').attr('data-id');;
                remoteStorage["study-planner"].removeCourse(id);
            });
        });
    }

    function displayModule(module) {
        var html = '<tr data-id=' + module.moduleId + '><td>' + module.moduleGroup + '</td><td>' + module.moduleName + '</td><td>' + module.moduleLp + '</td><td><div contenteditable class="semester">' + module.semester + '</div></td><td><div contenteditable class="grade">' + module.mark + '</div></td><td><span class="deleteButton glyphicon glyphicon-remove"></span></td></tr>';

        $('#moduleTable').append(html);
    }

    function hideModule(id) {
        $(`#moduleTable tr[data-id="${id}"]`).remove();
        updateSum();
        showModuleSum();
    }

    function updateSum() {
        var sumPoints = 0;
        var sumMarks = 0;
        var avgMarks;
        var counter = 0;
        if (modulesSelected) {
            for (var i = 0; i < modulesSelected.length; i++) {
                if (parseFloat(modulesSelected[i].mark) <= 4) {
                    sumPoints += parseInt(modulesSelected[i].moduleLp);
                    sumMarks += parseFloat(modulesSelected[i].mark);
                    counter++;
                }
            }

            avgMarks = sumMarks / counter;
        }

        $('#sum').text(sumPoints);
        $('#avg').text(isNaN(avgMarks) ? "" : avgMarks);
    }

    function showModuleSum() {
        var helperDict = {};
        var helperArray = [];

        if(modulesSelected === undefined || !modulesSelected) {
            return false;
        }

        for (var i = 0; i < modulesSelected.length; i++) {
            if (helperDict[modulesSelected[i].moduleGroup] === undefined) {
                helperDict[modulesSelected[i].moduleGroup] = {
                    success: modulesSelected[i].mark !== "" && parseFloat(modulesSelected[i].mark) <= 4 ? parseInt(modulesSelected[i].moduleLp) : 0,
                    planned: modulesSelected[i].mark === "" || parseFloat(modulesSelected[i].mark) <= 4 ? parseInt(modulesSelected[i].moduleLp) : 0
                };
            } else {
                helperDict[modulesSelected[i].moduleGroup].success += modulesSelected[i].mark !== "" && parseFloat(modulesSelected[i].mark) <= 4 ? parseInt(modulesSelected[i].moduleLp) : 0;
                helperDict[modulesSelected[i].moduleGroup].planned += modulesSelected[i].mark === "" || parseFloat(modulesSelected[i].mark) <= 4 ? parseInt(modulesSelected[i].moduleLp) : 0;
            }
        }

        $('#moduleSumTable').empty();
        var totalSum = 0;
        var totalSumPlanned = 0;

        Object.keys(helperDict).forEach(function (key) {
            totalSum += helperDict[key].success;
            totalSumPlanned += helperDict[key].planned;
            helperArray.push(key);
        });

        helperArray.sort();

        for (var i = 0; i < helperArray.length; i++) {
            var html = `<tr>
                                <td>${helperArray[i]}</td>
                                <td>${helperDict[helperArray[i]].success} <span style="color: grey">(${helperDict[helperArray[i]].planned})</span></td>
                            </tr>`;
            $('#moduleSumTable').append(html);
        }

        $('#sumFoot').html(`${totalSum} <span style="color: grey">(${totalSumPlanned})</span>`);
    }

    document.addEventListener('DOMContentLoaded', init);

})();