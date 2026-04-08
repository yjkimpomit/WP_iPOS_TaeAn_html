/**
 * 기능위치 트리
 * /common/modalPopup.jsp에 연결
 */
function facilityMaster1(zNodes) {
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
                // facilityMaster1: 리프 노드 클릭 시 상세조회
                if (treeId === 'facilityMaster1' && !node.isParent) {
                    $.ajax({
                        type: "POST",
                        url: "/common/facilitydetailList.do?searchUseYn=M1",
                        data: {locNo: node.id},
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
                }

                // facilityLoc1: 리프 노드 클릭 시 값 셋팅 후 닫기
                if (treeId === 'facilityLoc1' && !node.isParent) {
                    var code = node.id;
                    var code_name = String(node.text).replace(/^\[[^\]]+\]/, '').trim();

                    $('#fnLocationOption').val(code);
                    $('#fnLocationInput').val(code_name);

                    var treeObj = $.fn.zTree.getZTreeObj('facilityLoc1');
                    if (treeObj) {
                        treeObj.cancelSelectedNode();
                        treeObj.expandAll(false);
                    }
                    $('#searchFacilityLocTreePopup').find('.close').trigger('click');
                }
            }
        }
    };

    // zTree 초기화 (각 트리를 개별 초기화)
    $.fn.zTree.init($("#facilityMaster1"), setting, zNodes);
    $.fn.zTree.init($("#facilityLoc1"), setting, zNodes);

    // 검색 기능: zTree 퍼지 검색으로 대체
    var to = null;

    function debounce(fn, wait) {
        clearTimeout(to);
        to = setTimeout(fn, wait);
    }

    function filterZTree(treeSelector, query) {
        var treeObj = $.fn.zTree.getZTreeObj(treeSelector.replace('#', ''));
        if (!treeObj) return;

        var allNodes = treeObj.transformToArray(treeObj.getNodes());
        // 초기화: 모두 보이기/닫기
        treeObj.expandAll(false);
        allNodes.forEach(function (n) {
            n.highlight = false;
            treeObj.hideNode(n);
        });

        if (!query || query.length < 2) {
            allNodes.forEach(function (n) {
                treeObj.showNode(n);
            });
            return;
        }

        var matched = treeObj.getNodesByParamFuzzy('text', query, null).concat(treeObj.getNodesByParamFuzzy('name', query, null));
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
            children.forEach(function (c) {
                treeObj.showNode(c);
            });
        });
    }

    $('#search-input').off('keyup.fac1').on('keyup.fac1', function () {
        var q = $(this).val();
        debounce(function () {
            filterZTree('#facilityMaster1', q);
        }, 250);
    });
}

function fnInitLocation() {
    $.ajax({
        type: "POST",
        url: "/common/facilityLocList.do",
        dataType: "json",
        success: function (data) {
            facilityMaster1(data);
        }
    });
}

$(document).ready(function () {
    /* list data */
    fnInitLocation();
});
