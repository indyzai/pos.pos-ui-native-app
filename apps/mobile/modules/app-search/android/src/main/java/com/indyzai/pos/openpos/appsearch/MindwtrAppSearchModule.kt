package com.indyzai.pos.openpos.appsearch

import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class OpenPOSAppSearchModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("OpenPOSAppSearch")

    Function("isSupported") {
      OpenPOSAppSearchIndex.isSupported()
    }

    AsyncFunction("upsertDocuments") { docs: List<Map<String, Any?>>, promise: Promise ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val parsed = docs.mapNotNull(OpenPOSAppSearchDoc::fromMap)
      OpenPOSAppSearchIndex.upsert(context, parsed) { result ->
        result.fold(
          onSuccess = { promise.resolve(null) },
          onFailure = { promise.reject("ERR_APPSEARCH_UPSERT", it.message, it) }
        )
      }
    }

    AsyncFunction("removeDocuments") { ids: List<String>, promise: Promise ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      OpenPOSAppSearchIndex.remove(context, ids) { result ->
        result.fold(
          onSuccess = { promise.resolve(null) },
          onFailure = { promise.reject("ERR_APPSEARCH_REMOVE", it.message, it) }
        )
      }
    }

    AsyncFunction("wipeAll") { promise: Promise ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      OpenPOSAppSearchIndex.wipeAll(context) { result ->
        result.fold(
          onSuccess = { promise.resolve(null) },
          onFailure = { promise.reject("ERR_APPSEARCH_WIPE", it.message, it) }
        )
      }
    }
  }
}
