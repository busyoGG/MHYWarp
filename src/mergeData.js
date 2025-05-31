const mergeList = (a, b) => {
  if (!a || !a.length) return b || []
  if (!b || !b.length) return a
  const list = [...b, ...a]
  const result = []
  // const idSet = {}
  let saved = {};
  let indexSet = {};
  list.forEach(item => {
    if (!saved[item.id]) {
      result.push(item)
      indexSet[item.id] = result.length - 1
    } else {
      let itemKeys = Object.keys(item)
      let savedKeys = Object.keys(saved[item.id])
      if (itemKeys.length < 8) {
        console.log(itemKeys.length, savedKeys.length)
      }
      if (itemKeys.length != savedKeys.length) {
        for (let key of savedKeys) {
          if (!itemKeys.includes(key)) {
            item[key] = saved[item.id][key] == '' ? item[key] : saved[item.id][key]
          }
        }

        result[indexSet[item.id]] = item
        // console.log("item合并出现不同", item, saved[item.id])
      }
    }
    // idSet.add(item.id)
    saved[item.id] = item;
  })
  return result.sort((m, n) => {
    const num = BigInt(m.id) - BigInt(n.id)
    if (num > 0) {
      return 1
    } else if (num < 0) {
      return -1
    }
    return 0
  })
}

const mergeData = (local, origin) => {
  if (local && local.result) {
    const localResult = local.result
    const localUid = local.uid
    const originUid = origin.uid
    if (localUid !== originUid) return origin.result
    const originResult = new Map()
    for (let [key, value] of origin.result) {
      const newVal = mergeList(localResult.get(key), value)
      originResult.set(key, newVal)
    }
    return originResult
  }
  return origin.result
}

module.exports = { mergeData, mergeList }