var fs = require('fs'),
    path = require('path'),
    jade = require('jade'),
    md = require('marked'),
    Class = require('neko').Class;

var format = new require('fomatto').Formatter();


// Garden Generator -------------------------------------------------------------
// ------------------------------------------------------------------------------
var Garden = Class(function(options) {

    this.languages = {};
    this.options = options;
    this.options.language = this.json([this.options.dir, 'language.json'].join('/'));

    var languages = fs.readdirSync(options.dir);
    languages.forEach(function(lang) {
        if (!fs.statSync(this.options.dir + '/' + lang).isDirectory()) return;
        this.log('Parsing language "{}"...', lang);
        var langData = {
            id: lang,
            navigation: [],
            index: []
        };

        if (this.loadIndex(langData)) {
            this.languages[lang] = langData;
            this.log('    Done.');

        } else {
            this.log('    Error: Could not find "index.json"!');
        }
    },this);

    this.log('');
    this.generateAll();

}, {
    log: function() {
        console.log(format.apply(null, arguments));
    },

    loadIndex: function(lang) {
        lang.index = this.json([this.options.dir,
                                     lang.id, 'index.json'].join('/'));

        if (lang.index === null) {
            return false;
        }

        this.lang.title = this.lang.index.langTitle;
        lang.navigation = [];
        lang.index.sections.forEach(function(section, i) {
            this.loadSection(section,lang);
            this.lang.navigation.push({
                title: section.title,
                link: section.dir,
                articles: section.articles,
                parsed: section.parsed
            });
        },this);
        return true;
    },

    loadSection: function(section,lang) {
        var files = fs.readdirSync(this.folder(section.dir,lang));
        section.parsed = {};
        section.link = section.dir;

        section.articles = section.articles || [];
        section.articles.concat('index').forEach(function(article, e) {
            if (files.indexOf(article + '.md') !== -1) {
                var parsed = this.parseArticle(this.md(section.dir, article));
                section.parsed[article] = parsed;
                if (section.articles.indexOf(article) !== -1) {
                    section.articles[e] = {
                        id: article,
                        link: section.link + '.' + article,
                        title: parsed.title,
                        parsed: parsed
                    };
                }
            }
        });
    },

    parseArticle: function(text) {
        var title = text.substring(0, text.indexOf('\n'));
        text = text.substring(title.length);
        title = md(title.replace(/\#/g, '').trim());
        text = this.toMarkdown(text);

        var parts = text.split('<h3>');
        var subs = parts.map(function(sub,i) {
          return i > 0 ? '<h3>' : '') + sub;
        });

        return {
            title: title.substring(3, title.length - 4),
            text: text,
            subs: subs
        };
    },

    toMarkdown: function(text) {
        text = md(text).replace(/'/g,'&#39;');
        text = text.replace(/<blockquote>/g, '<aside>').
                    replace(/<\/blockquote>/g, '</aside>');

        return text.replace(/<aside>\s+<p><strong>ES5/g,
                            '<aside class="es5"><p><strong>ES5');
    },

    json: function(file) {
        try {
            return JSON.parse(fs.readFileSync(file).toString());

        } catch (err) {
            return null;
        }
    },

    md: function(section, article) {
        var file = [this.folder(section), article].join('/') + '.md';
        return fs.readFileSync(file).toString();
    },

    folder: function(section,lang) {
        return [this.options.dir, lang.id, section].join('/');
    },

    render: function(language, template, out) {
        var lang = this.languages[language];
        if(!lang) return;
        this.log('Rendering "{}" to "{}"...', language, out);

        var languages = [];
        for(var i in this.languages) {
            if (this.languages.hasOwnProperty(i)) {
                if (this.options.language.listed.indexOf(i) !== -1) {
                    languages.push(this.languages[i]);
                }
            }
        }

        var options = {
            pathPrefix: this.options.pathPrefix,
            baseLanguage: this.options.language.default,
            language: language,
            languages: languages,
            title: lang.index.title,
            description: lang.index.description,
            navigation: lang.navigation,
            sections: lang.index.sections,
            top: lang.navigation[0]
        };

        var jadefile = fs.readFileSync(template);
        var jadetemplate = jade.compile (jadefile);
        var html = jadetemplate(options);
        fs.writeFileSync(out, html);
        this.log('    Done.');
    },

    generateAll: function() {
        for(var i in this.languages) {
            if (this.languages.hasOwnProperty(i)) {
                this.generate(i);
            }
        }
    },

    generate: function(lang) {
        var dir = [this.options.out];
        if (lang !== this.options.language.default) {
            dir.push(lang);
        }
        dir = dir.join('/');

        path.exists(dir, function(exists) {
            if (!exists) {
                fs.mkdirSync(dir, '777');
            }
            this.render(lang, this.options.template, dir + '/index.html');
        }.bind(this));
    }
});

exports.build = function (options) {
    options = options || {dir: 'doc', pathPrefix: 'JavaScript-Garden/', template: 'garden.jade', out: 'site'};
    new Garden(options);
}

exports.build();
