/**
 * 설비 계통 트리 (search-facility-system.js)
 * /common/modalPopup.jsp에 연결
 */
function facilityMaster2(zNodes) {
    var setting = {
        view: {
            showIcon: false,
            nameIsHTML: true,
            selectedMulti: false
        },
        data: {
            key: {name: 'text'},
            simpleData: {
                enable: true,
                idKey: 'id',
                pIdKey: 'parent',
                rootPId: '#'
            }
        },
        callback: {
            onClick: function (event, treeId, node) {
                // facilityMaster2: 리프 노드 클릭 시 상세조회
                //if (treeId === 'facilityMaster2' && !node.isParent) {
                    $.ajax({
                        type: "POST",
                        url: "/common/facilitydetailList.do?searchUseYn=M2",
                        data: { eqCategory: node.id },
                        dataType: "html",
                        beforeSend: function () {
                            $("#loadingBar").css("display", "");
                        },
                        success: function (data) {
                            $("#facilityMasterList").html(data);
                        },
                        error: function (request, status, error) {
                            console.log("code:" + request.status + "\n message:" + request.responseText + "\n error:" + error);
                        },
                        complete: function () {
                            $("#loadingBar").css("display", "none");
                        }
                    });
                //}
            }
        }
    };

    // zTree 초기화
    $.fn.zTree.init($("#facilityMaster2"), setting, zNodes);

    // 검색 기능(zTree 퍼지 검색) - facility-location.js와 동일 패턴
    var to = null;
    function debounce(fn, wait) {
        clearTimeout(to);
        to = setTimeout(fn, wait);
    }
    function filterZTree(treeSelector, query) {
        var treeObj = $.fn.zTree.getZTreeObj(treeSelector.replace('#', ''));
        if (!treeObj) return;

        var allNodes = treeObj.transformToArray(treeObj.getNodes());
        // 초기화: 모두 숨김 후 필요 노드만 표시
        treeObj.expandAll(false);
        allNodes.forEach(function (n) {
            n.highlight = false;
            treeObj.hideNode(n);
        });

        if (!query || query.length < 2) {
            allNodes.forEach(function (n) { treeObj.showNode(n); });
            return;
        }

        var matched = treeObj.getNodesByParamFuzzy('text', query, null)
            .concat(treeObj.getNodesByParamFuzzy('name', query, null));
        var seen = new Set();
        matched.forEach(function (n) {
            if (seen.has(n.tId)) return;
            seen.add(n.tId);
            treeObj.showNode(n);

            var p = n.getParentNode();
            while (p) {
                treeObj.showNode(p);
                treeObj.expandNode(p, true, false, false);
                p = p.getParentNode();
            }

            var children = treeObj.transformToArray([n]);
            children.forEach(function (c) { treeObj.showNode(c); });
        });
    }

    $('#search-input').off('keyup.fac2').on('keyup.fac2', function () {
        var q = $(this).val();
        debounce(function () { filterZTree('#facilityMaster2', q); }, 250);
    });
}

function fnInitSystemTree() {
    $.ajax({
        type: "POST",
        url: "/common/facilitySysList.do",
        dataType: "json",
        success: function (data) {
            facilityMaster2(data);
        }
    });
}

$(document).ready(function () {
    fnInitSystemTree();
});
