const studyPlanner = {
    name: 'courses', builder: function (privateClient, publicClient) {
        privateClient.declareType('course', {
            "type": "object",
            "properties": {
                "id": { type: 'string' },
                "ects": { type: 'number' },
                "chapter": { type: 'object' },
                "subChapter": { type: 'array' },
                "mark": { type: 'number' },
                "semester": { type: 'string' },
                "name": { type: 'string' },
                "optional": {type: 'string'}
            },
            "required": ["id", "name", "chapter"]
        });

        // Return and export public functions
        return {
            exports: {
                init: function () {
                    privateClient.cache('');
                },

                on: privateClient.on,

                add: function (course) {
                    return privateClient.storeObject('course', course.id, course);
                },

                get: privateClient.getObject.bind(privateClient),

                remove: privateClient.remove.bind(privateClient),

                listCourses: function () {
                    return privateClient.getAll('');
                }
            }
        };
    }
}