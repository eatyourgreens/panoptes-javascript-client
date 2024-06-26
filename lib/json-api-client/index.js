(function() {
  var DEFAULT_HEADERS, Emitter, JSONAPIClient, Model, READ_OPS, RESERVED_TOP_LEVEL_KEYS, Resource, Type, WRITE_OPS, makeHTTPRequest, mergeInto,
    indexOf = [].indexOf;

  makeHTTPRequest = require('./make-http-request');

  mergeInto = require('./merge-into');

  Emitter = require('./emitter');

  Type = require('./type');

  Model = require('./model');

  Resource = require('./resource');

  DEFAULT_HEADERS = require('./default-headers');

  RESERVED_TOP_LEVEL_KEYS = ['meta', 'links', 'linked', 'data'];

  READ_OPS = ['HEAD', 'GET'];

  WRITE_OPS = ['POST', 'PUT', 'DELETE'];

  JSONAPIClient = (function() {
    var i, len, method, ref;

    class JSONAPIClient extends Model {
      constructor(root, headers1 = {}, mixins) {
        super(null);
        this.root = root;
        this.headers = headers1;
        this.params = {};
        this._typesCache = {};
        mergeInto(this, mixins);
      }

      beforeEveryRequest() {
        return Promise.resolve();
      }

      request(method, url, payload, headers, query) {
        return this.beforeEveryRequest().then(() => {
          var allHeaders, fullPayload, fullURL, request;
          method = method.toUpperCase();
          fullURL = this.root + url;
          fullPayload = mergeInto({}, this.params, payload);
          allHeaders = mergeInto({}, DEFAULT_HEADERS, this.headers, headers);
          if (indexOf.call(READ_OPS, method) >= 0) {
            this.update({
              reads: this.reads + 1
            });
          } else if (indexOf.call(WRITE_OPS, method) >= 0) {
            this.update({
              writes: this.writes + 1
            });
          }
          request = makeHTTPRequest.makeHTTPRequest(method, fullURL, fullPayload, allHeaders, query);
          request.catch(() => {
            return null;
          }).then(() => {
            if (indexOf.call(READ_OPS, method) >= 0) {
              return this.update({
                reads: this.reads - 1
              });
            } else if (indexOf.call(WRITE_OPS, method) >= 0) {
              return this.update({
                writes: this.writes - 1
              });
            }
          });
          return request.then(this.processResponse.bind(this)).catch(this.handleError.bind(this));
        });
      }

      processResponse(res) {
        var headers, j, k, l, len1, len2, len3, linkedResources, ref1, ref2, ref3, ref4, resourceData, resources, response, results, typeName;
        response = (function() {
          try {
            return JSON.parse(res.text);
          } catch (error) {
            return {};
          }
        })();
        ({headers} = res);
        if ('links' in response) {
          this._handleLinks(response.links);
        }
        if ('linked' in response) {
          for (typeName in response.linked) {
            linkedResources = response.linked[typeName];
            linkedResources.filter(Boolean).forEach((resourceData) => {
              this.type(typeName).create(resourceData, headers, response.meta);
            });
          }
        }
        results = [];
        if ('data' in response) {
          response.data.filter(Boolean).forEach((resourceData) => {
             results.push(this.type(resourceData.type).create(resourceData, headers, response.meta));
          });
        } else {
          for (typeName in response) {
            resources = response[typeName];
            if (indexOf.call(RESERVED_TOP_LEVEL_KEYS, typeName) < 0) {
              resources.filter(Boolean).forEach((resourceData) => {
                 results.push(this.type(typeName).create(resourceData, headers, response.meta));
              });
            }
          }
        }
        return results;
      }

      _handleLinks(links) {
        var attributeName, href, link, results1, type, typeAndAttribute, typeName;
        results1 = [];
        for (typeAndAttribute in links) {
          link = links[typeAndAttribute];
          [typeName, attributeName] = typeAndAttribute.split('.');
          if (typeof link === 'string') {
            href = link;
          } else {
            ({href, type} = link);
          }
          results1.push(this._handleLink(typeName, attributeName, href, type));
        }
        return results1;
      }

      _handleLink(typeName, attributeName, hrefTemplate, attributeTypeName) {
        var base, type;
        type = this.type(typeName);
        if ((base = type._links)[attributeName] == null) {
          base[attributeName] = {};
        }
        if (hrefTemplate != null) {
          type._links[attributeName].href = hrefTemplate;
        }
        if (attributeTypeName != null) {
          return type._links[attributeName].type = attributeTypeName;
        }
      }

      handleError() {
        // Override this as necessary.
        return Promise.reject(...arguments);
      }

      type(name) {
        var base;
        if ((base = this._typesCache)[name] == null) {
          base[name] = new Type(name, this);
        }
        return this._typesCache[name];
      }

      get(url, payload, headers, query) {
        return this.request('get', url, payload, headers, query);
      }

      post(url, payload, headers, query) {
        return this.request('post', url, payload, headers, query);
      }

      put(url, payload, headers, query) {
        return this.request('put', url, payload, headers, query);
      }

      delete(url, payload, headers, query) {
        return this.request('delete', url, payload, headers, query);
      }

    };

    JSONAPIClient.prototype.root = '/';

    JSONAPIClient.prototype.headers = null;

    JSONAPIClient.prototype.params = null;

    JSONAPIClient.prototype.reads = 0;

    JSONAPIClient.prototype.writes = 0;

    JSONAPIClient.prototype._typesCache = null; // Types that have been defined

    return JSONAPIClient;

  }).call(this);

  module.exports = JSONAPIClient;

  module.exports.makeHTTPRequest = makeHTTPRequest.makeHTTPRequest;

  module.exports.makeCredentialHTTPRequest = makeHTTPRequest.makeCredentialHTTPRequest;

  module.exports.Emitter = Emitter;

  module.exports.Type = Type;

  module.exports.Model = Model;

  module.exports.Resource = Resource;

}).call(this);
